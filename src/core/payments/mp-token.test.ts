import { describe, expect, it } from "vitest";

import { pickMpAccessToken } from "./mp-token";

describe("pickMpAccessToken (dinero)", () => {
  it("usa el token del panel (DB) por sobre el de entorno", () => {
    expect(pickMpAccessToken("APP-DB", "APP-ENV")).toBe("APP-DB");
  });

  it("cae al de entorno si no hay token en la DB", () => {
    expect(pickMpAccessToken(null, "APP-ENV")).toBe("APP-ENV");
    expect(pickMpAccessToken("", "APP-ENV")).toBe("APP-ENV");
    expect(pickMpAccessToken("   ", "APP-ENV")).toBe("APP-ENV");
    expect(pickMpAccessToken(undefined, "APP-ENV")).toBe("APP-ENV");
  });

  it("devuelve null si no hay ninguno", () => {
    expect(pickMpAccessToken(null, null)).toBeNull();
    expect(pickMpAccessToken("", "")).toBeNull();
    expect(pickMpAccessToken(undefined, undefined)).toBeNull();
  });

  it("recorta espacios en el token elegido", () => {
    expect(pickMpAccessToken(" APP-DB ", null)).toBe("APP-DB");
  });
});
