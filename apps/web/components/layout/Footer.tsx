"use client";

import styles from "./Footer.module.css";

interface FooterProps {
  message: string;
}

export function Footer({ message }: FooterProps) {
  return (
    <footer className={styles.footer}>
      <p>{message}</p>
    </footer>
  );
}
