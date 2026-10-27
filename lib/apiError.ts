// 원인을 알 수 있게 화면에 작게 보여 줄 오류 문구 (키 같은 비밀은 들어가지 않는다)
export async function errorCode(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
  return typeof body?.detail === "string" ? `${res.status} · ${body.detail}` : String(res.status);
}
