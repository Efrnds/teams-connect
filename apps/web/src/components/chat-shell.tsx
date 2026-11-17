'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Channel, type Message, type User } from '@/lib/api';
import { clearSession, getStoredUser, getToken } from '@/lib/auth';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { useU2uCall } from '@/hooks/use-u2u-call';
import { CallOverlay } from '@/components/call/call-overlay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function channelPrefix(type: string) {
  return type === 'DM' ? '@' : '#';
}

function resolveDmPeerId(
  channel: Channel,
  selfId: string,
  directory: User[],
): string | null {
  const fromMembers = channel.members?.find((m) => m.id !== selfId)?.id;
  if (fromMembers) return fromMembers;
  const byName = directory.find(
    (p) => (p.name || p.email) === channel.name,
  )?.id;
  return byName ?? null;
}

export function ChatShell() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [channelType, setChannelType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = getToken();
    const u = getStoredUser();
    if (!t || !u) {
      router.replace('/login');
      return;
    }
    setToken(t);
    setUser(u);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoadingChannels(true);
    Promise.all([api.channels(token), api.users(token)])
      .then(([list, users]) => {
        if (cancelled) return;
        setChannels(list);
        setPeople(users.filter((u) => u.id !== getStoredUser()?.id));
        const geral = list.find((c) => c.slug === 'geral');
        setChannelId((current) => current ?? geral?.id ?? list[0]?.id ?? null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingChannels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !channelId) return;
    let cancelled = false;
    setLoadingMessages(true);
    setTypingUserIds([]);
    api
      .messages(token, channelId)
      .then((list) => {
        if (!cancelled) setMessages(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const onSocketMessage = useCallback(
    (message: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        if (channelId && message.channelId !== channelId) return prev;
        return [...prev, message];
      });
    },
    [channelId],
  );

  const onTyping = useCallback(
    (payload: { channelId: string; userId: string; typing: boolean }) => {
      if (payload.channelId !== channelId) return;
      if (payload.userId === user?.id) return;
      setTypingUserIds((prev) => {
        const set = new Set(prev);
        if (payload.typing) set.add(payload.userId);
        else set.delete(payload.userId);
        return Array.from(set);
      });
    },
    [channelId, user?.id],
  );

  const { socket, typingStart, typingStop } = useChatSocket({
    token,
    channelId,
    onMessage: onSocketMessage,
    onTyping,
  });

  const resolveDisplayName = useCallback(
    (userId: string) => {
      if (userId === user?.id) return user.name || user.email;
      const listed = people.find((p) => p.id === userId);
      if (listed) return listed.name || listed.email;
      return `Usuário ${userId}`;
    },
    [people, user],
  );

  const {
    phase: callPhase,
    peer: callPeer,
    statusMessage: callStatus,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    cancelOutgoing,
    hangUp,
  } = useU2uCall({
    socket,
    selfUserId: user?.id ?? null,
    authToken: token,
    resolveDisplayName,
  });

  const active = channels.find((c) => c.id === channelId);
  const activeDmPeerId =
    active && user && active.type === 'DM'
      ? resolveDmPeerId(active, user.id, people)
      : null;
  const callIdle = callPhase === 'idle';
  const roomChannels = channels.filter((c) => c.type !== 'DM');
  const dmChannels = channels.filter((c) => c.type === 'DM');

  const typingLabel = useMemo(() => {
    if (!typingUserIds.length) return '';
    return 'Alguém está digitando...';
  }, [typingUserIds]);

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    if (!token || !channelId || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    typingStop(channelId);
    try {
      const msg = await api.sendMessage(token, channelId, draft.trim());
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  }

  async function openDm(otherUserId: string) {
    if (!token) return;
    try {
      const dm = await api.createDm(token, otherUserId);
      setChannels((prev) =>
        prev.some((c) => c.id === dm.id) ? prev : [...prev, dm],
      );
      setChannelId(dm.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir DM');
    }
  }

  if (!token || !user) {
    return (
      <main className="grid min-h-dvh place-items-center text-muted-foreground">
        Carregando sessão...
      </main>
    );
  }

  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  const activePrefix = active ? channelPrefix(active.type) : '#';

  return (
    <div className="flex h-dvh flex-col bg-background lg:flex-row">
      <aside className="flex w-full flex-col border-b border-sidebar-border bg-sidebar lg:w-64 lg:border-b-0 lg:border-r">
        <div className="border-b border-sidebar-border px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-copper">
            Texsa
          </p>
          <h1 className="text-lg font-semibold">Texsa Chat</h1>
          <div className="mt-3 flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="truncate text-xs text-muted-foreground">
              {user.name || user.email}
            </p>
          </div>
        </div>

        <ScrollArea className="flex-1 p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Canais
          </p>
          {loadingChannels && (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}
          <ul className="space-y-1">
            {roomChannels.map((channel) => {
              const activeItem = channel.id === channelId;
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    onClick={() => setChannelId(channel.id)}
                    className={`flex w-full items-center gap-2 px-2 py-2 text-left text-sm ${
                      activeItem
                        ? 'border-l-2 border-copper bg-sidebar-accent font-medium'
                        : 'border-l-2 border-transparent hover:bg-sidebar-accent/70'
                    }`}
                  >
                    <span className="text-muted-foreground">#</span>
                    <span className="truncate">{channel.name}</span>
                    {channel.isDefault && (
                      <span className="ml-auto font-mono text-[9px] text-copper">
                        global
                      </span>
                    )}
                    {!channel.isDefault && channel.type === 'PRIVATE' && (
                      <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                        priv
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <form
            className="mt-4 space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!token || !newChannel.trim()) return;
              try {
                const created = await api.createChannel(token, {
                  name: newChannel.trim(),
                  type: channelType,
                });
                setNewChannel('');
                setChannels((prev) => [...prev, created]);
                setChannelId(created.id);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : 'Falha ao criar canal',
                );
              }
            }}
          >
            <Input
              className="h-8"
              placeholder="Novo canal"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
            />
            <div className="flex gap-2">
              <select
                className="h-8 flex-1 border border-border bg-background px-2 text-xs"
                value={channelType}
                onChange={(e) =>
                  setChannelType(e.target.value as 'PUBLIC' | 'PRIVATE')
                }
              >
                <option value="PUBLIC">Público</option>
                <option value="PRIVATE">Privado</option>
              </select>
              <Button type="submit" size="sm" variant="secondary">
                +
              </Button>
            </div>
          </form>

          <p className="mb-2 mt-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Mensagens diretas
          </p>
          <ul className="space-y-1">
            {dmChannels.map((channel) => {
              const activeItem = channel.id === channelId;
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    onClick={() => setChannelId(channel.id)}
                    className={`flex w-full items-center gap-2 px-2 py-2 text-left text-sm ${
                      activeItem
                        ? 'border-l-2 border-copper bg-sidebar-accent font-medium'
                        : 'border-l-2 border-transparent hover:bg-sidebar-accent/70'
                    }`}
                  >
                    <span className="text-muted-foreground">@</span>
                    <span className="truncate">{channel.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mb-2 mt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Pessoas
          </p>
          <ul className="space-y-1">
            {people.map((person) => (
              <li key={person.id}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent/70"
                    onClick={() => void openDm(person.id)}
                  >
                    <Avatar className="size-5">
                      <AvatarFallback className="text-[9px]">
                        {(person.name || person.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {person.name || person.email}
                    </span>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={!callIdle}
                    onClick={() => startCall(person.id)}
                  >
                    Ligar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>

        <Separator />
        <Button
          variant="ghost"
          className="justify-start rounded-none px-4 py-6"
          onClick={() => {
            clearSession();
            router.push('/login');
          }}
        >
          Sair
        </Button>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">
                {active
                  ? `${activePrefix}${active.name}`
                  : 'Selecione um canal'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {active?.type === 'PRIVATE'
                  ? 'Canal privado'
                  : active?.type === 'DM'
                    ? 'Mensagem direta'
                    : active?.description || 'Mensagens da equipe Texsa'}
                {active?.isDefault ? ' · global' : ''}
              </p>
            </div>
            {activeDmPeerId && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!callIdle}
                onClick={() => startCall(activeDmPeerId)}
              >
                Ligar
              </Button>
            )}
          </div>
        </header>

        <CallOverlay
          phase={callPhase}
          peer={callPeer}
          statusMessage={callStatus}
          remoteAudioRef={remoteAudioRef}
          onAccept={() => void acceptCall()}
          onReject={rejectCall}
          onCancel={cancelOutgoing}
          onHangUp={hangUp}
        />

        <ScrollArea className="flex-1 px-4 py-4">
          {loadingMessages && (
            <p className="text-sm text-muted-foreground">
              Carregando mensagens...
            </p>
          )}
          {!loadingMessages && !messages.length && (
            <p className="text-sm text-muted-foreground">
              Canal vazio. Mande a primeira mensagem.
            </p>
          )}
          <div className="space-y-4">
            {messages.map((message) => (
              <article key={message.id}>
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">
                    {message.author.name || message.author.email}
                  </span>
                  <time className="font-mono text-[10px] text-muted-foreground">
                    {new Date(message.createdAt).toLocaleString('pt-BR')}
                  </time>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">
                  {message.body}
                </p>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border bg-card px-4 py-3">
          {typingLabel && (
            <p className="mb-2 text-xs text-muted-foreground">{typingLabel}</p>
          )}
          {error && (
            <p className="mb-2 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <form onSubmit={sendMessage} className="space-y-2">
            <Textarea
              className="min-h-16 resize-y"
              placeholder={
                active
                  ? `Mensagem em ${activePrefix}${active.name}`
                  : 'Selecione um canal'
              }
              value={draft}
              disabled={!channelId || sending}
              onChange={(e) => {
                setDraft(e.target.value);
                if (channelId) typingStart(channelId);
              }}
              onBlur={() => channelId && typingStop(channelId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!channelId || !draft.trim() || sending}
              >
                Enviar
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
