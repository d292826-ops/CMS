import {Button,StateMessage} from '../ui/components.tsx';import {navigate} from '../app/router.tsx';
export function NotFoundPage(){return <StateMessage title="Страница не найдена" actions={<Button onClick={()=>navigate('/')}>К рабочим задачам</Button>}><p>Проверьте адрес или вернитесь к началу демонстрации.</p></StateMessage>;}
