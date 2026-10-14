import { builder } from "../builder";
import { InterventionStatus, Priority, Role } from "../generated/prisma/enums";

export const RoleEnum = builder.enumType(Role, { name: "Role" });
export const InterventionStatusEnum = builder.enumType(InterventionStatus, { name: "InterventionStatus" });
export const PriorityEnum = builder.enumType(Priority, { name: "Priority" });
