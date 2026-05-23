import type { FunctionComponent, ComponentChildren } from 'preact';
import styles from './StandaloneLayout.module.css';

interface StandaloneLayoutProps {
  title?: string;
  children: ComponentChildren;
  class?: string;
}

const StandaloneLayout: FunctionComponent<StandaloneLayoutProps> = ({ title, children, class: className }) => (
  <main class={`${styles.layout} ${className ?? ''}`}>
    {title && <h1 class={styles.title}>{title}</h1>}
    {children}
  </main>
);

export default StandaloneLayout;
