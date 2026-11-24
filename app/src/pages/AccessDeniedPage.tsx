import {Button,StateMessage} from '../ui/components.tsx';import {navigate} from '../app/router.tsx';
export function AccessDeniedPage(){return <StateMessage title="Сначала выберите участника" actions={<Button onClick={()=>navigate('/')}>Выбрать участника</Button>}><p>Это учебный переключатель рабочих ролей, а не корпоративный вход.</p></StateMessage>;}
