import { usePlanner } from '../../app/store';
import { Toast } from '../../ui/primitives';
import { CaptureSheet } from '../../features/capture/CaptureSheet';
import { PlacePicker } from '../../features/places/PlacePicker';
import { FocusOverlay } from '../../features/focus/FocusOverlay';
import { NotificationTray } from '../../features/notify/NotificationTray';
import { SettingsSheet } from '../../features/settings/SettingsSheet';
import { SignIn } from '../../features/auth/SignIn';
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

      <PlacePicker variant="desktop" />
      <NotificationTray />
      <CaptureSheet variant="desktop" />
      <SettingsSheet />
      <SignIn />
      <FocusOverlay variant="desktop" />

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
