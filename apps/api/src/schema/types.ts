import { builder } from "../builder";
import { InterventionStatusEnum, PriorityEnum, RoleEnum } from "./enums";

builder.prismaObject("User", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    email: t.exposeString("email"),
    phone: t.exposeString("phone", { nullable: true }),
    role: t.expose("role", { type: RoleEnum }),
  }),
});

builder.prismaObject("Customer", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    email: t.exposeString("email", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    sites: t.relation("sites"),
  }),
});

builder.prismaObject("Site", {
  fields: (t) => ({
    id: t.exposeID("id"),
    label: t.exposeString("label"),
    address: t.exposeString("address"),
    city: t.exposeString("city"),
    postalCode: t.exposeString("postalCode"),
    latitude: t.exposeFloat("latitude"),
    longitude: t.exposeFloat("longitude"),
    accessNotes: t.exposeString("accessNotes", { nullable: true }),
    customer: t.relation("customer"),
  }),
});

builder.prismaObject("ChecklistItem", {
  fields: (t) => ({
    id: t.exposeID("id"),
    label: t.exposeString("label"),
    position: t.exposeInt("position"),
    checked: t.exposeBoolean("checked"),
  }),
});

builder.prismaObject("Photo", {
  fields: (t) => ({
    id: t.exposeID("id"),
    url: t.exposeString("url"),
    caption: t.exposeString("caption", { nullable: true }),
    takenAt: t.expose("takenAt", { type: "DateTime" }),
  }),
});

builder.prismaObject("Signature", {
  fields: (t) => ({
    id: t.exposeID("id"),
    url: t.exposeString("url"),
    signerName: t.exposeString("signerName"),
    signedAt: t.expose("signedAt", { type: "DateTime" }),
  }),
});

builder.prismaObject("StatusEvent", {
  fields: (t) => ({
    id: t.exposeID("id"),
    status: t.expose("status", { type: InterventionStatusEnum }),
    at: t.expose("at", { type: "DateTime" }),
    author: t.relation("author"),
  }),
});

builder.prismaObject("Intervention", {
  fields: (t) => ({
    id: t.exposeID("id"),
    reference: t.exposeString("reference"),
    type: t.exposeString("type"),
    description: t.exposeString("description", { nullable: true }),
    priority: t.expose("priority", { type: PriorityEnum }),
    status: t.expose("status", { type: InterventionStatusEnum }),
    scheduledStart: t.expose("scheduledStart", { type: "DateTime" }),
    scheduledEnd: t.expose("scheduledEnd", { type: "DateTime" }),
    visitNumber: t.exposeInt("visitNumber"),
    report: t.exposeString("report", { nullable: true }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
    site: t.relation("site"),
    technician: t.relation("technician", { nullable: true }),
    checklist: t.relation("checklist", { query: { orderBy: { position: "asc" } } }),
    photos: t.relation("photos", { query: { orderBy: { takenAt: "asc" } } }),
    signature: t.relation("signature", { nullable: true }),
    events: t.relation("events", { query: { orderBy: { at: "asc" } } }),
  }),
});
