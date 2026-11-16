export function assertSenderMatches(socketUserId, declaredFromUserId) {
    if (!socketUserId)
        return false;
    if (declaredFromUserId !== undefined && declaredFromUserId !== socketUserId) {
        return false;
    }
    return true;
}
export function assertCalleeNotSelf(callerId, calleeUserId) {
    return callerId !== calleeUserId;
}
export function isSessionParticipant(session, userId) {
    return session.callerId === userId || session.calleeId === userId;
}
export function assertCalleeForSession(session, userId) {
    return session.calleeId === userId;
}
//# sourceMappingURL=call-signaling.js.map