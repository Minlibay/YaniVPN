"use client";

export type SshForm = {
  port: string;
  username: string;
  auth: "password" | "key";
  password: string;
  privateKey: string;
};

export const initialSsh: SshForm = {
  port: "22",
  username: "root",
  auth: "password",
  password: "",
  privateKey: "",
};

export function sshPayload(ssh: SshForm) {
  return {
    port: Number(ssh.port),
    username: ssh.username,
    ...(ssh.auth === "password" ? { password: ssh.password } : { privateKey: ssh.privateKey }),
  };
}

const inputCls =
  "w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-[#3987e5]";

export function SshFields({ value, onChange }: { value: SshForm; onChange: (v: SshForm) => void }) {
  const set = (patch: Partial<SshForm>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="grid gap-3 rounded-lg border border-surface-border p-3">
      <legend className="px-1 text-xs text-slate-400">SSH-доступ (используется один раз, не сохраняется)</legend>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-slate-400">Пользователь</label>
          <input
            required
            className={inputCls}
            value={value.username}
            onChange={(e) => set({ username: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Порт SSH</label>
          <input
            required
            type="number"
            min={1}
            max={65535}
            className={inputCls}
            value={value.port}
            onChange={(e) => set({ port: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={value.auth === "password"}
            onChange={() => set({ auth: "password" })}
          />
          Пароль
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={value.auth === "key"} onChange={() => set({ auth: "key" })} />
          Приватный ключ
        </label>
      </div>
      {value.auth === "password" ? (
        <input
          required
          type="password"
          className={inputCls}
          placeholder="Пароль root"
          autoComplete="new-password"
          value={value.password}
          onChange={(e) => set({ password: e.target.value })}
        />
      ) : (
        <textarea
          required
          rows={4}
          className={`${inputCls} font-mono text-xs`}
          placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n..."}
          value={value.privateKey}
          onChange={(e) => set({ privateKey: e.target.value })}
        />
      )}
    </fieldset>
  );
}
