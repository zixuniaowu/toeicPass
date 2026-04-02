"use client";

import styles from "./Footer.module.css";

interface FooterProps {
  message: string;
}

export function Footer({ message }: FooterProps) {
  if (!message) return null;

  return (
    <footer className={styles.footer}>
      <p key={message} className={styles.messageText}>{message}</p>
    </footer>
  );
}
