export const adminCreateUserSchema = {
  tags: ["admin"],
  summary: "유저 생성 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["id", "name"],
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 3, maxLength: 30, default: "" },
      name: { type: "string", minLength: 1, maxLength: 50, default: "" },
      department: { type: "string", maxLength: 100, default: "" },
      globalRole: { type: "string", enum: ["ADMIN", "USER"], default: "USER" },
      // 비번을 특정 값으로 지정하고 싶으면 선택적으로 허용
      password: { type: "string", maxLength: 72, default: "" },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["user"],
      properties: {
        user: {
          type: "object",
          required: ["userId", "id", "name", "department", "globalRole"],
          properties: {
            userId: { type: "string" },
            id: { type: "string" },
            name: { type: "string" },
            department: { type: ["string", "null"] },
            globalRole: { type: "string" },
          },
        },
      },
    },
    409: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    400: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    401: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    403: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};


export const adminSetUserRoleSchema = {
  tags: ["admin"],
  summary: "유저 권한 변경 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "string" },
    },
  },
  body: {
    type: "object",
    required: ["globalRole"],
    additionalProperties: false,
    properties: {
      globalRole: { type: "string", enum: ["ADMIN", "USER"], default: "USER" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "user"],
      properties: {
        ok: { type: "boolean" },
        user: {
          type: "object",
          required: ["userId", "id", "name", "globalRole"],
          properties: {
            userId: { type: "string" },
            id: { type: "string" },
            name: { type: "string" },
            globalRole: { type: "string" },
          },
        },
      },
    },
    400: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    401: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    403: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    404: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};

// 유저 목록 조회
export const adminListUsersSchema = {
  tags: ["admin"],
  summary: "유저 목록 조회 (ADMIN)",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: "object",
      required: ["users"],
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            required: ["userId", "id", "name", "department", "globalRole", "isActive"],
            properties: {
              userId: { type: "string" },
              id: { type: "string" },
              name: { type: "string" },
              department: { type: ["string", "null"] },
              globalRole: { type: "string" },
              isActive: { type: "boolean" },
            },
          },
        },
      },
    },
  },
};

// 비밀번호 초기화
export const adminResetPasswordSchema = {
  tags: ["admin"],
  summary: "유저 비밀번호 초기화 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "string" },
    },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      password: {
        type: "string",
        minLength: 8,
        maxLength: 72,
        default: "",
      },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "defaultPassword"],
      properties: {
        ok: { type: "boolean" },
        defaultPassword: { type: "string" },
      },
    },
    404: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } },
  },
};

export const adminDeleteUserSchema = {
  tags: ["admin"],
  summary: "유저 삭제 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      properties: { ok: { type: "boolean" } },
    },
    400: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    401: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    403: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    404: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};



export const adminCreateTeamSchema = {
  tags: ["admin/teams"],
  summary: "팀 생성 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 50, default: "" },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["team"],
      properties: {
        team: {
          type: "object",
          required: ["teamId", "name", "joinCode"],
          properties: {
            teamId: { type: "string" },
            name: { type: "string" },
            joinCode: { type: "string" },
          },
        },
      },
    },
    400: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    401: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    403: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};

export const adminDeleteTeamSchema = {
  tags: ["admin/teams"],
  summary: "팀 삭제 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: {
      teamId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      properties: { ok: { type: "boolean" } },
    },
    401: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    403: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    404: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};

export const adminAddTeamMemberSchema = {
  tags: ["admin/teams"],
  summary: "팀에 유저 추가 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: { teamId: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["userId"],
    additionalProperties: false,
    properties: {
      userId: { type: "string", default: "" },
      role: { type: "string", enum: ["MEMBER"], default: "MEMBER" }, // 지금은 MEMBER만
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "teamId", "userId"],
      properties: {
        ok: { type: "boolean" },
        teamId: { type: "string" },
        userId: { type: "string" },
      },
    },
    404: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    409: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};

export const adminRemoveTeamMemberSchema = {
  tags: ["admin/teams"],
  summary: "팀에서 탈퇴 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId", "userId"],
    properties: {
      teamId: { type: "string" },
      userId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      properties: { ok: { type: "boolean" } },
    },
    404: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};


export const adminListTeamsSchema = {
  tags: ["admin/teams"],
  summary: "팀 목록 조회 (ADMIN)",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: "object",
      required: ["teams"],
      properties: {
        teams: {
          type: "array",
          items: {
            type: "object",
            required: ["teamId", "name", "joinCode"],
            properties: {
              teamId: { type: "string" },
              name: { type: "string" },
              joinCode: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export const adminListTeamMembersSchema = {
  tags: ["admin/teams"],
  summary: "팀 멤버 목록 조회 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: { teamId: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["members"],
      properties: {
        members: {
          type: "array",
          items: {
            type: "object",
            required: ["userId", "id", "name", "department", "globalRole", "role", "isActive"],
            properties: {
              userId: { type: "string" },
              id: { type: "string" },
              name: { type: "string" },
              department: { type: ["string", "null"] },
              globalRole: { type: "string" },
              role: { type: "string" }, // TeamRole
              isActive: { type: "boolean" },
            },
          },
        },
      },
    },
    404: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};
