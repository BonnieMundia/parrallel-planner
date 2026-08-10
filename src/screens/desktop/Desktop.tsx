import { usePlanner } from '../../app/store';
import { Toast } from '../../ui/primitives';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Today } from './Today';
import styles from './Desktop.module.css';

export function Desktop() {
  const { state } = usePlanner();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.body}>
        <TopBar />
        {/* Week, Deadlines and Zones land in step 6. */}
        {state.tab === 'today' && <Today />}
        {state.tab !== 'today' && <div className={styles.pending} />}
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
