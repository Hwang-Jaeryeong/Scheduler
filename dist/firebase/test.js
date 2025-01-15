"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = __importDefault(require("./firebase"));
function fetchUserData() {
    return __awaiter(this, void 0, void 0, function* () {
        const snapshot = yield firebase_1.default.collection("user")
            .orderBy("admin.handleDate", "desc")
            .limit(10)
            .get();
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`User ID: 2205081206001340`);
            console.log(`userPointBuy: ${data.userPointBuy}`);
            console.log(`userPointUse: ${data.userPointUse}`);
        });
    });
}
fetchUserData().catch(err => console.error("Error fetching user data:", err));
