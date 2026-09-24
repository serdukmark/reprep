import { readFile } from "node:fs/promises";
import { test as base, expect, Locator } from "@playwright/test";
export { expect };
export const test = base.extend<{ auditReset: void }>({
  auditReset: [
    async ({ request, baseURL, context }, use) => {
      if (process.env.E2E_AUDIT !== "1") {
        await use();
        return;
      }
      if (
        !baseURL ||
        !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)
      )
        throw Error("Audit reset allowed only on isolated loopback server");
      expect((await request.post("/__audit__/new-client")).ok()).toBeTruthy();
      const session = await request.post("/api/auth/demo/tutor");
      expect(session.ok()).toBeTruthy();
      const reset = await request.post("/api/demo/reset", {
        headers: { Authorization: "Bearer " + (await session.json()).token },
      });
      expect(reset.ok()).toBeTruthy();
      if (
        [
          "choice-role",
          "choice-value",
          "lesson-status",
          "rejection-note",
        ].includes(process.env.E2E_MUTATION || "")
      ) {
        await context.route("**/assets/*.js", async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          const mutated =
            process.env.E2E_MUTATION === "choice-role"
              ? body.replaceAll('role:"combobox"', 'role:"button"')
              : process.env.E2E_MUTATION === "rejection-note"
                ? body.replace(
                    /"Работа отклонена без оценки\. "\+\w+\.review\.note/g,
                    '"Преподаватель проверил работу."',
                  )
                : process.env.E2E_MUTATION === "lesson-status"
                  ? body.replace(/\((\w+\.status)\?\?"scheduled"\)/g, "$1")
                  : body.replace(
                      /\w+\.Children\.toArray\(\w+\.props\.children\)\.join\(""\)/g,
                      '\"\"',
                    );
          if (mutated === body) throw Error("Mutation target missing");
          await route.fulfill({ response, body: mutated });
        });
      }
      if (process.env.E2E_MUTATION_ASSET) {
        const body = await readFile(process.env.E2E_MUTATION_ASSET, "utf8");
        await context.route("**/assets/*.js", (route) =>
          route.fulfill({
            contentType: "application/javascript",
            body,
          }),
        );
      }
      await use();
    },
    { auto: true },
  ],
});
export async function choose(
  locator: Locator,
  value: string | { index: number },
) {
  const control = locator.first();
  const root = control.locator(
    'xpath=ancestor-or-self::*[contains(concat(" ",normalize-space(@class)," ")," choice-select ")][1]',
  );
  const optionIndex = () =>
    root
      .locator("select")
      .evaluate(
        (select: HTMLSelectElement, wanted) =>
          typeof wanted === "string"
            ? Array.from(select.options).findIndex((x) => x.value === wanted)
            : wanted.index < select.options.length
              ? wanted.index
              : -1,
        value,
      );
  // Options can arrive after the form is visible. Wait as a user would,
  // without forcing hidden native controls or racing the data request.
  await expect.poll(optionIndex).toBeGreaterThanOrEqual(0);
  const index = await optionIndex();
  await root.locator(".choice-trigger").click();
  await control
    .page()
    .getByRole("listbox")
    .getByRole("option")
    .nth(index)
    .click();
}
