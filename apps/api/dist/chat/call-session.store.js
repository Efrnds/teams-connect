var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let CallSessionStore = class CallSessionStore {
    sessions = new Map();
    create(session) {
        if (this.sessions.has(session.callId))
            return false;
        this.sessions.set(session.callId, session);
        return true;
    }
    get(callId) {
        return this.sessions.get(callId);
    }
    updateState(callId, state) {
        const session = this.sessions.get(callId);
        if (!session)
            return undefined;
        session.state = state;
        return session;
    }
    remove(callId) {
        this.sessions.delete(callId);
    }
    findRingingForUser(userId) {
        for (const session of this.sessions.values()) {
            if (session.state === 'ringing' &&
                (session.callerId === userId || session.calleeId === userId)) {
                return session;
            }
        }
        return undefined;
    }
};
CallSessionStore = __decorate([
    Injectable()
], CallSessionStore);
export { CallSessionStore };
//# sourceMappingURL=call-session.store.js.map