"""Tutor-defined prerequisite graph over confirmed evidence, not AI diagnosis."""
import json
from graphlib import TopologicalSorter,CycleError
from fastapi import Depends
from pydantic import Field,field_validator,model_validator
from .models import Model
from .db import one,dumps
from .service import progress,audit


class SkillEdge(Model):
    prerequisite:str=Field(min_length=1,max_length=100)
    skill:str=Field(min_length=1,max_length=100)


class SkillGraphInput(Model):
    revision:int=Field(ge=0)
    skills:list[str]=Field(default_factory=list,max_length=50)
    edges:list[SkillEdge]=Field(default_factory=list,max_length=200)

    @field_validator('skills')
    @classmethod
    def valid_skills(cls,value):
        value=[s.strip() for s in value]
        if any(not s or len(s)>100 for s in value) or len({s.casefold() for s in value})!=len(value):raise ValueError('Навыки должны быть различны и непусты')
        return value

    @model_validator(mode='after')
    def valid_graph(self):
        graph={s:set() for s in self.skills}
        pairs=set()
        for edge in self.edges:
            if edge.prerequisite not in graph or edge.skill not in graph:raise ValueError('Связь с неизвестным навыком')
            if (edge.prerequisite,edge.skill) in pairs:raise ValueError('Повтор связи')
            pairs.add((edge.prerequisite,edge.skill));graph[edge.skill].add(edge.prerequisite)
        try:tuple(TopologicalSorter(graph).static_order())
        except CycleError:raise ValueError('В предпосылках не должно быть циклов')
        return self


def install(app,user,db,tutor,relation,fail):
    def view(c,id_):
        item=one(c,'SELECT * FROM skill_graphs WHERE relationship_id=?',(id_,))
        config=json.loads(item['data']) if item else {'skills':[],'edges':[]}
        confirmed={r['skill'].casefold():r for r in progress(c,id_)}
        nodes=[]
        for skill in config['skills']:
            row=confirmed.get(skill.casefold(),{})
            parents=[edge['prerequisite'] for edge in config['edges'] if edge['skill']==skill]
            nodes.append({'skill':skill,'latest':row.get('latest','unknown'),'correct':row.get('correct',0),'total':row.get('total',0),
                'evidence_count':len(row.get('evidence',[])),
                'prerequisites_confirmed':all(confirmed.get(parent.casefold(),{}).get('latest')=='correct' for parent in parents)})
        return {'revision':item['revision'] if item else 0,**config,'nodes':nodes,
            'available_skills':[r['skill'] for r in confirmed.values()],
            'note':'Связи задаёт преподаватель. Показан последний подтверждённый результат. Полноту освоения оценивает преподаватель.'}

    @app.get('/api/relationships/{id_}/skill-graph')
    def skill_graph(id_:str,u=Depends(user),c=Depends(db)):
        relation(c,id_,u);return view(c,id_)

    @app.put('/api/relationships/{id_}/skill-graph')
    def save_skill_graph(id_:str,body:SkillGraphInput,u=Depends(user),c=Depends(db)):
        tutor(u);relation(c,id_,u)
        old=one(c,'SELECT revision FROM skill_graphs WHERE relationship_id=?',(id_,));revision=old['revision'] if old else 0
        if body.revision!=revision:fail(409,'VERSION_CONFLICT','Граф изменился в другом окне')
        c.execute('INSERT INTO skill_graphs VALUES(?,?,?) ON CONFLICT(relationship_id) DO UPDATE SET revision=excluded.revision,data=excluded.data',(id_,revision+1,dumps(body.model_dump(exclude={'revision'}))))
        audit(c,u['id'],'skill_graph_updated',id_)
        return view(c,id_)
