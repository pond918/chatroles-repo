export enum AppConstant {
  clsKeyCurrentUser = '_currentUser',
  /** role with no host, do nothing. for user. */
  emptyRoleId = 'do-nothing-role',
  /** role to recommend roles,  */
  rolesRoleId = 'roles-role',
  /** role to chat with user, with roles-role's recommendations */
  chatRoleId = 'chat-role',
  translatorRoleId = 'translator-role',
  systemUsername = 'ChatRoles-system-user',
}
