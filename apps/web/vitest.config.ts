import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    globals: true,
  },
  resolve: {
    alias: {
      "@toeicpass/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@toeicpass/ad-system/web": path.resolve(__dirname, "../../packages/ad-system/web"),
      "@toeicpass/ad-system": path.resolve(__dirname, "../../packages/ad-system/src"),
      "@toeicpass/conversation-ai/web": path.resolve(__dirname, "../../packages/conversation-ai/web"),
      "@toeicpass/conversation-ai": path.resolve(__dirname, "../../packages/conversation-ai/src"),
    },
  },
});
