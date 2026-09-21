"""Local transparent assessment and replaceable approved remote adapter."""
from decimal import Decimal, InvalidOperation
import json
import time
from pathlib import Path
import httpx
from .models import Analysis, TaskAssessment, QuestionAnswer

PROMPT_VERSION = 'assessment-v2'


class ContextTooLarge(ValueError):
    pass


def context_for(assignment, answers, history):
    skills = {t['skill'] for t in assignment['tasks']}
    return {'schema_version': '1', 'prompt_version': PROMPT_VERSION,
            'tasks': assignment['tasks'], 'answers': answers,
            'confirmed_history': [{'skill': h['skill'], 'correctness': h['correctness']}
                                  for h in history if h['skill'] in skills][:12]}


def validate_analysis(data, context):
    analysis = Analysis.model_validate(data)
    expected = {t['id']: t['skill'] for t in context['tasks']}
    if len(analysis.tasks) != len(expected) or {t.task_id for t in analysis.tasks} != set(expected):
        raise ValueError('Wrong assessment tasks')
    if any(expected[t.task_id] != t.skill for t in analysis.tasks):
        raise ValueError('Untrusted skill identifier')
    return analysis


class LocalRules:
    def analyze(self, context):
        results = []
        for task in context['tasks']:
            answer = context['answers'].get(task['id'], '').strip()
            expected = task['answer'].strip()
            correctness = 'unknown'
            if answer and task['type'] == 'numeric':
                try:
                    value = Decimal(answer.replace(',', '.'))
                    if value.is_finite():
                        correctness = 'correct' if value == Decimal(expected.replace(',', '.')) else 'incorrect'
                except InvalidOperation:
                    pass
            elif answer and task['type'] == 'single_choice':
                correctness = 'correct' if answer == expected else 'incorrect'
            elif answer and task['type'] == 'short_text' and expected and answer.casefold() == expected.casefold():
                correctness = 'correct'
            feedback = {
                'correct': 'Ответ совпадает с эталоном. Преподаватель проверит ход решения.',
                'incorrect': 'Ответ отличается от эталона. Проверьте вычисления и условия задания.',
                'unknown': 'Автоматическая проверка не может надёжно оценить этот ответ. Его посмотрит преподаватель.'
            }[correctness]
            results.append(TaskAssessment(task_id=task['id'], correctness=correctness,
                confidence=1.0 if correctness != 'unknown' else 0,
                summary_for_tutor=feedback, feedback_for_learner=feedback,
                hint=task.get('hint', ''), skill=task['skill']))
        known = sum(t.correctness != 'unknown' for t in results)
        return Analysis(engine='local_rules_v1', assessment_status='assessed' if known == len(results) else 'partially_assessed' if known else 'cannot_assess', tasks=results)


class RemoteAdapter:
    """Provider-neutral gateway contract, not an assumed vendor endpoint."""
    def __init__(self, url, key):
        self.url, self.key = url, key

    def analyze(self, context):
        with httpx.Client(timeout=20, follow_redirects=False) as client:
            response = client.post(self.url, headers={'Authorization': f'Bearer {self.key}'}, json=context)
            response.raise_for_status()
            if len(response.content) > 100_000:
                raise ValueError('Oversized assessment')
            return validate_analysis(response.json(), context)


class OpenRouterAdapter:
    def __init__(self, key, model):
        if not key or not model:
            raise ValueError('OpenRouter configuration missing')
        self.key, self.model = key, model
        self.last_usage = {}
        self.last_output = ''

    def answer_question(self,context):
        if len(json.dumps(context,ensure_ascii=False).encode())>30000: raise ContextTooLarge()
        schema=QuestionAnswer.model_json_schema()
        prompt=(Path(__file__).parent/'prompts'/'question-v3.txt').read_text()
        payload={'model':self.model,'messages':[{'role':'system','content':prompt},{'role':'user','content':json.dumps(context,ensure_ascii=False)}],
            'temperature':0.1,'max_tokens':1200,'reasoning':{'enabled':False},
            'provider':{'require_parameters':True,'max_price':{'prompt':1,'completion':1},'data_collection':'deny'},
            'response_format':{'type':'json_schema','json_schema':{'name':'question_answer','strict':True,'schema':schema}}}
        with httpx.Client(timeout=40,follow_redirects=False) as client:
            response=client.post('https://openrouter.ai/api/v1/chat/completions',headers={'Authorization':'Bearer '+self.key,'X-OpenRouter-Title':'reprep'},json=payload)
            if response.status_code!=200: raise RuntimeError('Question provider unavailable')
            raw=response.json()
        if not isinstance(raw,dict) or raw.get('error') or not isinstance(raw.get('choices'),list) or not raw['choices']: raise ValueError('Invalid question envelope')
        choice=raw['choices'][0]
        if not isinstance(choice,dict) or choice.get('finish_reason') not in ('stop',None) or not isinstance(choice.get('message'),dict): raise ValueError('Incomplete question answer')
        content=choice['message'].get('content')
        if not isinstance(content,str) or not content.strip() or len(content.encode())>30000: raise ValueError('Invalid question answer')
        result=QuestionAnswer.model_validate(json.loads(content))
        usage=raw.get('usage') if isinstance(raw.get('usage'),dict) else {}
        self.last_question_usage={k:v for k in ('prompt_tokens','completion_tokens','total_tokens','cost') if isinstance((v:=usage.get(k)),(int,float))}
        return result

    def analyze(self, context):
        schema = Analysis.model_json_schema()
        def strict(node):
            if isinstance(node, dict):
                node.pop('default', None)
                if node.get('type') == 'object':
                    node['additionalProperties'] = False
                    node['required'] = list(node.get('properties', {}))
                for v in node.values(): strict(v)
            elif isinstance(node, list):
                for v in node: strict(v)
        strict(schema)
        prompt = (Path(__file__).parent/'prompts'/'assessment-v2.txt').read_text()
        payload = {'model': self.model, 'messages': [
            {'role': 'system', 'content': prompt}, {'role': 'user', 'content': json.dumps(context, ensure_ascii=False)}],
            'temperature': 0.1, 'max_tokens': 6000, 'reasoning': {'enabled': False},
            'provider': {'require_parameters': True, 'max_price': {'prompt': 1, 'completion': 1}, 'data_collection': 'deny'},
            'response_format': {'type': 'json_schema', 'json_schema': {'name': 'assessment', 'strict': True, 'schema': schema}}}
        start = time.monotonic()
        with httpx.Client(timeout=55, follow_redirects=False) as client:
            response = client.post('https://openrouter.ai/api/v1/chat/completions',
                headers={'Authorization': 'Bearer '+self.key, 'X-OpenRouter-Title': 'reprep'}, json=payload)
            if response.status_code != 200:
                # Never include raw upstream bodies or authorization headers in errors.
                raise RuntimeError(f'OpenRouter HTTP {response.status_code}')
            raw = response.json()
        if not isinstance(raw, dict):
            raise ValueError('Invalid response envelope')
        if raw.get('error') or not raw.get('choices'):
            raise RuntimeError('OpenRouter returned no assessment')
        if not isinstance(raw['choices'], list):
            raise ValueError('Invalid response choices')
        choice = raw['choices'][0]
        if not isinstance(choice, dict) or not isinstance(choice.get('message'), dict):
            raise ValueError('Invalid response message')
        self.last_output = choice['message'].get('content', '')
        usage = raw.get('usage') if isinstance(raw.get('usage'), dict) else {}
        self.last_usage = {k: usage.get(k) for k in ('prompt_tokens','completion_tokens','total_tokens','cost')}
        self.last_usage['latency_seconds'] = round(time.monotonic()-start, 3)
        if choice.get('finish_reason') not in ('stop', None):
            raise ValueError('Incomplete assessment')
        content=choice['message'].get('content')
        if not isinstance(content,str) or not content.strip() or len(content.encode())>100000:
            raise ValueError('Empty or oversized assessment')
        output = json.loads(content)
        if not isinstance(output, dict):
            raise ValueError('Invalid assessment object')
        output['engine'] = self.model
        output['prompt_version'] = PROMPT_VERSION
        result = validate_analysis(output, context)
        usage = raw.get('usage') if isinstance(raw.get('usage'), dict) else {}
        self.last_usage = {k: usage.get(k) for k in ('prompt_tokens','completion_tokens','total_tokens','cost')}
        self.last_usage['latency_seconds'] = round(time.monotonic()-start, 3)
        return result
