import { Document, Model, Schema, model } from 'mongoose';

export interface MessageStates {
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface MessageDocument extends Document {
  messageId: string;
  userHash: string;
  subjectSnippet?: string;
  threadHint?: string;
  headers?: Record<string, string>;
  states: MessageStates;
  createdAt: Date;
  updatedAt: Date;
}

const stateSchema = new Schema<MessageStates>(
  {
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date }
  },
  { _id: false }
);

const messageSchema = new Schema<MessageDocument>(
  {
    messageId: { type: String, required: true, unique: true, index: true },
    userHash: { type: String, required: true, index: true },
    subjectSnippet: { type: String },
    threadHint: { type: String },
    headers: { type: Schema.Types.Mixed },
    states: { type: stateSchema, default: {} }
  },
  {
    timestamps: true
  }
);

export const Message: Model<MessageDocument> = model<MessageDocument>('Message', messageSchema);
