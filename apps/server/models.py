from typing import Literal, Annotated
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, StringConstraints


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Task(Model):
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    type: Literal['numeric', 'single_choice', 'short_text']
    prompt: str = Field(min_length=3, max_length=3000)
    options: list[str] = Field(default_factory=list, max_length=8)
    answer: str = Field(default='', max_length=1000)
    rubric: str = Field(default='', max_length=2000)
    skill: str = Field(min_length=1, max_length=100)
    hint: str = Field(default='', max_length=1000)

    @model_validator(mode='after')
    def reference(self):
        if not self.answer and not self.rubric:
            raise ValueError('Укажите эталонный ответ или критерии проверки')
        if self.type == 'numeric':
            try:
                value = Decimal(self.answer.replace(',', '.'))
                if not value.is_finite():
                    raise ValueError('Требуется конечное число')
            except InvalidOperation:
                raise ValueError('Эталон должен быть числом')
        if self.type == 'single_choice':
            if len(self.options) < 2 or len(set(self.options)) != len(self.options) or self.answer not in self.options:
                raise ValueError('Нужны разные варианты и один эталон из списка')
        return self


class AssignmentInput(Model):
    client_id: str = Field(default="", exclude=True, max_length=100, pattern=r"^(?:[a-zA-Z0-9_-]{8,100})?$")
    relationship_id: str
    lesson_id: str = Field(default="",max_length=100)
    title: str = Field(min_length=3, max_length=160)
    instructions: str = Field(default='', max_length=3000)
    due_at: datetime | None = None
    feedback_policy: Literal['after_review', 'hints_first'] = 'after_review'
    tasks: list[Task] = Field(min_length=1, max_length=20)

    @field_validator('due_at')
    @classmethod
    def timezone(cls, value):
        if value and not value.tzinfo:
            raise ValueError('Дедлайн должен включать часовой пояс')
        return value

    @model_validator(mode='after')
    def unique_tasks(self):
        if len({t.id for t in self.tasks}) != len(self.tasks):
            raise ValueError('Идентификаторы заданий должны быть уникальны')
        return self


class AnswerFile(Model):
    file_name: str = Field(min_length=5,max_length=100)
    content: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(min_length=1,max_length=60000)

    @model_validator(mode='after')
    def valid_txt(self):
        if not self.file_name.endswith('.txt') or any(ch in self.file_name for ch in ('/',chr(92),chr(0))):
            raise ValueError('Нужен TXT-файл без пути в имени')
        if chr(0) in self.content or len(self.content.encode())>60000:
            raise ValueError('Нужен текст UTF-8 до 60 KB без нулевых байтов')
        return self


class DraftInput(Model):
    revision: int = Field(ge=0)
    answers: dict[str, str]
    attachments: dict[str, AnswerFile] = Field(default_factory=dict)

    @field_validator('attachments')
    @classmethod
    def attachment_bounds(cls,value):
        if len(value)>3 or any(len(k)>80 for k in value) or sum(len(f.content.encode()) for f in value.values())>60000:
            raise ValueError('Не более трёх TXT-файлов, суммарно до 60 KB')
        return value

    @field_validator('answers')
    @classmethod
    def bounds(cls, value):
        if len(value) > 20 or any(len(k) > 80 or len(v) > 5000 for k, v in value.items()):
            raise ValueError('Ответ слишком длинный')
        return value


Correctness = Literal['correct', 'incorrect', 'partially_correct', 'unknown']


class TaskAssessment(Model):
    task_id: str
    correctness: Correctness
    confidence: float = Field(ge=0, le=1)
    summary_for_tutor: str = Field(max_length=3000)
    feedback_for_learner: str = Field(max_length=2000)
    hint: str = Field(default='', max_length=1000)
    skill: str = Field(max_length=100)


class Analysis(Model):
    schema_version: Literal['1'] = '1'
    assessment_status: Literal['assessed', 'partially_assessed', 'cannot_assess', 'provider_unavailable', 'output_invalid']
    engine: str = Field(max_length=80)
    prompt_version: str = 'assessment-v1'
    requires_tutor_review: Literal[True] = True
    tasks: list[TaskAssessment] = Field(max_length=20)


class ReviewedTask(Model):
    task_id: str
    correctness: Correctness
    feedback: str = Field(min_length=1, max_length=3000)


class ReviewInput(Model):
    action: Literal['confirmed', 'corrected', 'rejected', 'returned']
    tasks: list[ReviewedTask] = Field(default_factory=list, max_length=20)
    note: str = Field(default='', max_length=2000)


class InviteInput(Model):
    subject: str = Field(min_length=2, max_length=100)


class ProfileInput(Model):
    alias: str = Field(min_length=1,max_length=60)


class PlanStep(Model):
    title: str = Field(min_length=2,max_length=160)
    skill: str = Field(min_length=1,max_length=100)
    status: Literal['planned','in_progress','completed'] = 'planned'
    assignment_id: str = Field(default='',max_length=100)
    material_id: str = Field(default='',max_length=100)


class PlanInput(Model):
    revision: int = Field(ge=0)
    goal: str = Field(min_length=2,max_length=1000)
    level: str = Field(default='',max_length=100)
    steps: list[PlanStep] = Field(default_factory=list,max_length=50)


class MessageInput(Model):
    client_id: str = Field(min_length=10,max_length=80,pattern=r'^[a-zA-Z0-9_-]+$')
    text: str = Field(min_length=1,max_length=3000)


class QuestionInput(MessageInput):
    task_id: str = Field(min_length=1,max_length=80)


class QuestionAnswer(Model):
    status: Literal['answered','off_topic','needs_teacher']
    text: str = Field(min_length=1,max_length=3000)
    confidence: float = Field(ge=0,le=1)


class QuestionReview(Model):
    text: str = Field(min_length=1,max_length=3000)


class GroupInput(Model):
    revision: int = Field(default=0,ge=0)
    title: str = Field(min_length=2,max_length=100)
    relationship_ids: list[str] = Field(min_length=1,max_length=20)

    @field_validator('relationship_ids')
    @classmethod
    def unique_members(cls,value):
        if len(set(value))!=len(value) or any(len(x)>100 for x in value):raise ValueError('Участники не должны повторяться')
        return value


class GroupAssignment(Model):
    revision: int = Field(ge=1)
    client_id: str = Field(min_length=10,max_length=80,pattern=r'^[a-zA-Z0-9_-]+$')
    assignment_id: str = Field(min_length=1,max_length=100)


class GroupSchedule(Model):
    revision: int = Field(ge=1)
    client_id: str = Field(min_length=10,max_length=80,pattern=r'^[a-zA-Z0-9_-]+$')
    title: str = Field(min_length=2,max_length=160)
    starts_at: datetime
    duration: int = Field(default=60,ge=15,le=240)

    @field_validator('starts_at')
    @classmethod
    def zoned(cls,value):
        if not value.tzinfo:raise ValueError('Укажите часовой пояс')
        return value


class GenerationRequest(Model):
    client_id: str = Field(min_length=10,max_length=80,pattern=r'^[a-zA-Z0-9_-]+$')
    count: int = Field(default=3,ge=1,le=5)


class GeneratedWork(Model):
    title: str = Field(min_length=3,max_length=160)
    instructions: str = Field(max_length=3000)
    tasks: list[Task] = Field(min_length=1,max_length=5)


class TokenInput(Model):
    token: str = Field(min_length=10, max_length=200)


class MaxLogin(Model):
    init_data: str = Field(max_length=16000)
    role: Literal['tutor', 'learner', 'guardian']
    alias: str = Field(default='Участник', min_length=1, max_length=60)


class LessonInput(Model):
    relationship_id: str
    title: str = Field(min_length=2, max_length=160)
    starts_at: datetime
    duration: int = Field(default=60, ge=15, le=240)
    payment_status: Literal['unknown', 'paid', 'unpaid', 'waived'] = 'unknown'
    status: Literal['scheduled','completed','cancelled'] = 'scheduled'

    @field_validator('starts_at')
    @classmethod
    def timezone(cls, value):
        if not value.tzinfo:
            raise ValueError('Укажите часовой пояс')
        return value


class MaterialInput(Model):
    relationship_id: str
    title: str = Field(min_length=2, max_length=160)
    url: str = Field(default='', max_length=2000)
    note: str = Field(default='', max_length=500)
    file_name: str = Field(default='',max_length=100)
    content: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(default='',max_length=60000)
    assignment_id: str = Field(default='',max_length=100)
    lesson_id: str = Field(default='',max_length=100)
    ai_allowed: bool = False

    @model_validator(mode='after')
    def safe_material(self):
        import re
        if self.content:
            if self.url or not self.file_name.endswith('.txt') or any(x in self.file_name for x in ('/','\\','\x00')):
                raise ValueError('Разрешён только отдельный TXT-файл')
            if len(self.content.encode())>60000 or '\x00' in self.content:
                raise ValueError('TXT должен быть UTF-8 до 60 KB без нулевых байтов')
        elif not re.fullmatch(r'https://[^\s]+',self.url) or self.file_name:
            raise ValueError('Укажите HTTPS-ссылку или непустой TXT-файл')
        return self


class ReportInput(Model):
    context_id: str = Field(max_length=100)
    category: Literal['incorrect_feedback', 'harmful_feedback', 'bug', 'useful']
    text: str = Field(default='', max_length=2000)
