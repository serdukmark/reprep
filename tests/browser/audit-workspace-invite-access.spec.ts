import { test, expect } from "./audit-fixtures";
for (const mode of ["create", "revoke-foreign-space", "revoke-foreign-invite"])
  test(`workspace invitation ${mode}: forged identifiers cannot grant or revoke a colleague's access`, async ({
    page,
    request,
  }) => {
    const auth = async (role: string) => ({
      Authorization:
        "Bearer " +
        (await (await request.post("/api/auth/demo/" + role)).json()).token,
    });
    const oh = await auth("tutor"),
      fh = await auth("outsider");
    const make = async (headers: Record<string, string>, title: string) => {
      const space = await request.post("/api/workspaces", {
        headers,
        data: { title },
      });
      expect(space.ok()).toBe(true);
      const id = (await space.json()).id;
      const invite = await request.post(`/api/workspaces/${id}/invite`, {
        headers,
      });
      expect(invite.ok()).toBe(true);
      return { id, invitation: (await invite.json()).id };
    };
    const own = await make(oh, "Моё пространство"),
      foreign = await make(fh, "Чужое пространство");
    const foreignPath = `/api/workspaces/${foreign.id}/invitations`;
    const before = await (
      await request.get(foreignPath, { headers: fh })
    ).json();
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await page.getByRole("button", { name: "Ученики", exact: true }).click();
    const endpoint =
      mode === "create"
        ? `/api/workspaces/${own.id}/invite`
        : `/api/workspaces/${own.id}/invitations/${own.invitation}/revoke`;
    const forged =
      mode === "create"
        ? `/api/workspaces/${foreign.id}/invite`
        : `/api/workspaces/${mode === "revoke-foreign-space" ? foreign.id : own.id}/invitations/${foreign.invitation}/revoke`;
    let denied = 0;
    await page.route("**" + endpoint, async (r) => {
      const response = await r.fetch({
        url: new URL(forged, r.request().url()).href,
      });
      expect(response.status()).toBe(404);
      denied++;
      await r.fulfill({ response });
    });
    const button = page.getByRole("button", {
      name:
        mode === "create"
          ? "Пригласить коллегу"
          : "Отозвать приглашение коллеги",
      exact: true,
    });
    await button.click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect.poll(() => denied).toBe(1);
    await expect(
      page.getByLabel("Код для коллеги", { exact: true }),
    ).toHaveCount(0);
    expect(
      await (await request.get(foreignPath, { headers: fh })).json(),
    ).toEqual(before);
    const ownInvites = await (
      await request.get(`/api/workspaces/${own.id}/invitations`, {
        headers: oh,
      })
    ).json();
    expect(ownInvites).toHaveLength(1);
    expect(ownInvites[0].state).toBe("created");
    await page.unroute("**" + endpoint);
    await button.click();
    if (mode === "create")
      await expect(
        page.getByLabel("Код для коллеги", { exact: true }),
      ).toBeVisible();
    else await expect(button).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
