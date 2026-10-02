import {Calendar as BigCalendar,dateFnsLocalizer} from 'react-big-calendar';
import {format,parse,startOfWeek,getDay} from 'date-fns';
import {enIN} from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
const localizer=dateFnsLocalizer({format,parse,startOfWeek:date=>startOfWeek(date,{weekStartsOn:1}),getDay,locales:{'en-IN':enIN}});
export default function Calendar({events,onSelect,date,onNavigate}){return <div className="card" style={{height:520}}><BigCalendar culture="en-IN" localizer={localizer} events={events} startAccessor="start" endAccessor="end" views={['month','week','day','agenda']} defaultView="month" date={date} onNavigate={onNavigate} onSelectEvent={onSelect} eventPropGetter={()=>({style:{backgroundColor:'#35745d',borderRadius:5}})}/></div>;}
