import { builder } from "../builder";
import "./enums";
import "./types";
import "./queries";
import "./mutations";
import "./subscriptions";

export const schema = builder.toSchema({ sortSchema: true });
