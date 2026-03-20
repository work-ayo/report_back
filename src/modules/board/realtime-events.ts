export type CardMovedEvent = {
  type: "card:moved";
  boardId: string;
  cardId: string;
  fromColumnId: string;
  toColumnId: string;
  toIndex: number;
  actorUserId: string;
  requestId?: string | null;
  updatedAt: string;
};

export type ColumnMovedEvent = {
  type: "column:moved";
  boardId: string;
  columnId: string;
  toIndex: number;
  actorUserId: string;
  requestId?: string | null;
  updatedAt: string;
};

export type CardCreatedEvent = {
  type: "card:created";
  boardId: string;
  card: any;
  actorUserId: string;
  requestId?: string | null;
  updatedAt: string;
};

export type CardUpdatedEvent = {
  type: "card:updated";
  boardId: string;
  card: any;
  actorUserId: string;
  requestId?: string | null;
  updatedAt: string;
};

export type CardDeletedEvent = {
  type: "card:deleted";
  boardId: string;
  cardId: string;
  columnId: string;
  actorUserId: string;
  requestId?: string | null;
  updatedAt: string;
};


export type ColumnCreatedEvent = {
  type: "column:created";
  boardId: string;
  column: any;
  actorUserId: string;
  requestId?: string | null;
  updatedAt: string;
};

export type ColumnUpdatedEvent = {
  type: "column:updated";
  boardId: string;
  column: any;
  actorUserId: string;
  requestId?: string | null;
  updatedAt: string;
};

export type ColumnDeletedEvent = {
  type: "column:deleted";
  boardId: string;
  columnId: string;
  actorUserId: string;
  requestId?: string | null;
  updatedAt: string;
};

export type BoardRealtimeEvent =
  | CardMovedEvent
  | ColumnMovedEvent
  | CardCreatedEvent
  | CardUpdatedEvent
  | CardDeletedEvent
  | ColumnCreatedEvent
  | ColumnUpdatedEvent
  | ColumnDeletedEvent;
  