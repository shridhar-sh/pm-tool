// Resolve legacy short names without guessing when a short name is duplicated.
export function matchesAssignee(assignment, user, members) {
  const normalize = value => String(value || '').trim().toLowerCase();
  const assigned = normalize(assignment);
  const name = normalize(user.name);
  if (!assigned) return false;
  if (assigned === name) return true;
  const candidates = members.filter(member =>
    [member.id, member.employeeId, member.shortName].some(value => normalize(value) === assigned)
  );
  return candidates.length === 1 && normalize(candidates[0].name) === name;
}
