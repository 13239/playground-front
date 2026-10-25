import styles from "./site-footer.module.css";

/** 홈과 게임 화면이 같은 사이트 푸터를 사용한다. 화면별 여백은 className으로만 더한다. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={className ? `${styles.footer} ${className}` : styles.footer}>
      <span>Playground</span>
      <p>함께라서 더 즐거운 우리들의 놀이터.</p>
      <small>© {new Date().getFullYear()} Playground</small>
    </footer>
  );
}
