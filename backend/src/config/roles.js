/**
 * SINGLE SOURCE OF TRUTH: RBAC Configuration
 * Roles are defined as collections of granular permission strings.
 */

const PERMISSIONS = {
  // Session / Auth
  READ_DEVICES: 'read:devices',
  REVOKE_SESSION: 'revoke:session',
  MANAGE_ALL_SESSIONS: 'manage:all_sessions',
  
  // Interviews / Transcripts
  VIEW_TRANSCRIPT: 'view:transcript',
  VIEW_ALL_TRANSCRIPTS: 'view:all_transcripts',
  START_INTERVIEW: 'start:interview',
  VIEW_ANALYTICS: 'view:analytics',
  PROCESS_AUDIO: 'process:audio',
  UPLOAD_FILES: 'upload:files',
  
  // Admin
  ADMIN_PANEL: 'admin:access',
  MANAGE_ROLES: 'manage:roles',
  MANAGE_USERS: 'manage:users'
};

const ROLES = {
  ADMIN: 'admin',
  INTERVIEWER: 'interviewer',
  CANDIDATE: 'candidate'
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS), // Admin gets everything
  
  [ROLES.INTERVIEWER]: [
    PERMISSIONS.READ_DEVICES,
    PERMISSIONS.REVOKE_SESSION,
    PERMISSIONS.VIEW_TRANSCRIPT,
    PERMISSIONS.START_INTERVIEW,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.PROCESS_AUDIO,
    PERMISSIONS.UPLOAD_FILES
  ],
  
  [ROLES.CANDIDATE]: [
    PERMISSIONS.READ_DEVICES,
    PERMISSIONS.REVOKE_SESSION,
    PERMISSIONS.VIEW_TRANSCRIPT,
    PERMISSIONS.START_INTERVIEW,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.PROCESS_AUDIO,
    PERMISSIONS.UPLOAD_FILES
  ]
};

/**
 * Get permissions for a specific role
 */
const getPermissionsByRole = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

module.exports = {
  ROLES,
  PERMISSIONS,
  getPermissionsByRole,
  allPermissions: Object.values(PERMISSIONS)
};
