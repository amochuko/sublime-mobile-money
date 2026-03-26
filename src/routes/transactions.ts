import { Router } from "express";
import {
  cancelTransactionHandler,
  depositHandler,
  getTransactionHandler,
  getTransactionHistoryHandler,
  searchTransactionsHandler,
  updateNotesHandler,
  withdrawHandler,
} from "../controllers/transactionController";
import { validateTransaction } from "../middleware/validateTransaction";
import { TimeoutPresets, haltOnTimedout } from "../middleware/timeout";

export const transactionRoutes = Router();

transactionRoutes.get(
  "/",
  TimeoutPresets.quick,
  haltOnTimedout,
  getTransactionHistoryHandler,
);

transactionRoutes.get(
  "/search",
  TimeoutPresets.quick,
  haltOnTimedout,
  searchTransactionsHandler,
);

transactionRoutes.post(
  "/deposit",
  TimeoutPresets.long,
  haltOnTimedout,
  validateTransaction,
  depositHandler
);

transactionRoutes.post(
  "/withdraw",
  TimeoutPresets.long,
  haltOnTimedout,
  validateTransaction,
  withdrawHandler
);

transactionRoutes.get(
  "/:id",
  TimeoutPresets.quick,
  haltOnTimedout,
  getTransactionHandler
);

transactionRoutes.post(
  "/:id/cancel",
  TimeoutPresets.quick,
  haltOnTimedout,
  cancelTransactionHandler,
);

transactionRoutes.patch(
  "/:id/notes",
  TimeoutPresets.quick,
  haltOnTimedout,
  updateNotesHandler,
);
