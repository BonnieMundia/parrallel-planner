import { usePlanner } from '../../app/store';
import { Toast } from '../../ui/primitives';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Today } from './Today';
import { Week } from './Week';
import { Deadlines } from './Deadlines';
import { Zones } from './Zones';
import styles from './Desktop.module.css';

export function Desktop() {
  const { state } = usePlanner();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.body}>
        <TopBar />
        {state.tab === 'today' && <Today />}
        {state.tab === 'week' && <Week />}
        {state.tab === 'due' && <Deadlines />}
        {state.tab === 'zones' && <Zones />}
      </div>
      {state.toast && (
        <Toast
          title={state.toast.title}
          sub={state.toast.sub}
          color={state.toast.color}
          out={state.toastOut}
        />
      )}
    </div>
  );
}
