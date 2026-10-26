import type { Permission, PermissionCode } from "./contracts";

/** 필요한 접근·조회 권한은 함께 선택하고 선행 권한을 해제하면 의존 기능도 함께 해제한다. */
export function toggleRolePermission(permissions: readonly Permission[], selected: readonly PermissionCode[], code: PermissionCode, enabled: boolean): readonly PermissionCode[] {
  const dictionary = new Map(permissions.map(permission => [permission.code, permission]));
  const target = dictionary.get(code);
  if (!target || target.superAdminOnly) return selected;
  const next = new Set(selected);
  if (enabled) {
    const pending: PermissionCode[] = [code];
    const visited = new Set<PermissionCode>();
    while (pending.length) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      next.add(current);
      pending.push(...(dictionary.get(current)?.requiredPermissions ?? []));
    }
  } else {
    next.delete(code);
    let removed = true;
    while (removed) {
      removed = false;
      for (const permission of permissions) {
        if (next.has(permission.code) && permission.requiredPermissions.some(required => !next.has(required))) {
          next.delete(permission.code); removed = true;
        }
      }
    }
  }
  return permissions.filter(permission => next.has(permission.code)).map(permission => permission.code);
}
