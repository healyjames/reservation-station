import type { FunctionComponent, ComponentChildren } from 'preact';
import styles from './StandaloneLayout.module.css';

interface StandaloneLayoutProps {
  title?: string;
  children: ComponentChildren;
  class?: string;
}

const StandaloneLayout: FunctionComponent<StandaloneLayoutProps> = ({ title, children, class: className }) => (
  <main class={styles.page}>
    <div class={styles.container}>
      <section class={`${styles.card} ${className ?? ''}`}>
        {title && <h1 class={styles.title}>{title}</h1>}
        <div class={styles.content}>{children}</div>
      </section>
    </div>
  </main>
);

export default StandaloneLayout;
