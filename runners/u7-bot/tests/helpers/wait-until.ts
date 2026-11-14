/**
 * Опрашивает `probe` раз в 20 мс до истины или таймаута. При таймауте
 * не бросает: проверку результата делает вызывающий тест.
 */
export async function waitUntil(
  probe: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
}
