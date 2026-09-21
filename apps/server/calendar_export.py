"""Private one-way iCalendar export. RFC 5545 sections 3.1, 3.3.11, 3.6.1."""
from datetime import datetime,timedelta,timezone


def text(value):
    return value.replace('\\','\\\\').replace('\r\n','\n').replace('\r','\n').replace('\n','\\n').replace(';','\\;').replace(',','\\,')


def folded(value):
    lines=[];line=''
    for char in value:
        if len((line+char).encode('utf-8'))>75:
            lines.append(line);line=' '
        line+=char
    return '\r\n'.join([*lines,line])


def calendar(lessons,stamp=None):
    timestamp=(stamp or datetime.now(timezone.utc)).strftime('%Y%m%dT%H%M%SZ')
    lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//reprep//private schedule//RU','CALSCALE:GREGORIAN']
    for lesson in lessons:
        start=datetime.fromisoformat(lesson['starts_at']).astimezone(timezone.utc)
        end=start+timedelta(minutes=lesson['duration'])
        lines.extend(['BEGIN:VEVENT','UID:'+text(lesson['id'])+'@reprep.local','DTSTAMP:'+timestamp,
            'DTSTART:'+start.strftime('%Y%m%dT%H%M%SZ'),'DTEND:'+end.strftime('%Y%m%dT%H%M%SZ'),
            'SUMMARY:'+text(lesson['title']),
            'STATUS:'+('CANCELLED' if lesson.get('status')=='cancelled' else 'CONFIRMED'),'END:VEVENT'])
    return '\r\n'.join(folded(line) for line in [*lines,'END:VCALENDAR'])+'\r\n'
