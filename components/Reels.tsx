import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from './Buttons';
import { EmptyState } from './EmptyState';
import { TextInput } from './Input';
import { PAGE_SCROLL } from './PageSwipe';
import { Sheet } from './Sheet';
import { Pressable } from './Tap';
import { WATCHED_AFTER_SEC } from '../lib/config';
import { formatDay } from '../lib/format';
import { initials } from '../lib/identity';
import { VideoComment, useStore } from '../lib/store';
import { C, F, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';
import { success, tick } from '../lib/haptics';
import { TeamVideo, mediaSource } from '../lib/videos';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Status = 'loading' | 'ready' | 'error';
type Row = { kind: 'video'; id: string; video: TeamVideo } | { kind: 'end'; id: string };

/** Hauteur réservée en bas à la barre de navigation, qui reste utilisable par-dessus. */
const BAR_SPACE = 72;

/** Lecteur de la vidéo affichée. Une seule vidéo est chargée à la fois. */
function ReelPlayer({
  video,
  muted,
  paused,
  onStatus,
  onFirstFrame,
  onTime,
  onBlocked,
}: {
  video: TeamVideo;
  muted: boolean;
  paused: boolean;
  onStatus: (status: Status) => void;
  onFirstFrame: () => void;
  onTime: (current: number, duration: number) => void;
  onBlocked: () => void;
}) {
  const player = useVideoPlayer(mediaSource(video.source), (p) => {
    p.loop = true;
    p.muted = muted;
    p.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  // La lecture démarre une fois l'image à l'écran, et s'arrête dès que l'on met en pause.
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [player, paused]);

  useEventListener(player, 'statusChange', ({ status }) => {
    onStatus(status === 'error' ? 'error' : status === 'readyToPlay' ? 'ready' : 'loading');
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    onTime(currentTime, player.duration);
  });

  // Certains navigateurs refusent de démarrer seuls une vidéo avec le son : on coupe alors le son.
  useEffect(() => {
    if (muted || paused) return;
    const timer = setTimeout(() => {
      if (player.status === 'readyToPlay' && !player.playing) onBlocked();
    }, 900);
    return () => clearTimeout(timer);
  }, [player, muted, paused, onBlocked]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls={false}
      allowsPictureInPicture={false}
      fullscreenOptions={{ enable: false }}
      playsInline
      onFirstFrameRender={onFirstFrame}
      accessible={false}
    />
  );
}

function Action({
  icon,
  label,
  a11y,
  tint = C.text,
  selected,
  bump = 0,
  onPress,
}: {
  icon: IconName;
  label?: string;
  a11y: string;
  tint?: string;
  selected?: boolean;
  /** Change à chaque fois que l'icône doit « sauter » (J'aime). */
  bump?: number;
  onPress: () => void;
}) {
  const pop = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.value = withSequence(
      withTiming(1.35, { duration: 110 }),
      withSpring(1, { damping: 8, stiffness: 240 }),
    );
  }, [bump, pop]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Pressable
      onPress={onPress}
      scaleTo={0.86}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={selected === undefined ? undefined : { selected }}
      aria-pressed={selected}
      style={styles.action}
    >
      <View style={styles.actionDisc}>
        <Animated.View style={iconStyle}>
          <Ionicons name={icon} size={23} color={tint} />
        </Animated.View>
      </View>
      {!!label && (
        <Text style={styles.actionLabel} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

type ItemProps = {
  video: TeamVideo;
  index: number;
  count: number;
  width: number;
  height: number;
  top: number;
  bottomSpace: number;
  /** Cette vidéo est à l'écran et l'espace Découvrir est ouvert : elle peut jouer. */
  playing: boolean;
  muted: boolean;
  watched: boolean;
  liked: boolean;
  commentCount: number;
  onMute: () => void;
  onBlocked: () => void;
  onWatched: (id: string) => void;
  onLike: (id: string) => void;
  onComments: (id: string) => void;
  onInfo: () => void;
  onGo: (index: number) => void;
};

const ReelItem = memo(function ReelItem({
  video,
  index,
  count,
  width,
  height,
  top,
  bottomSpace,
  playing,
  muted,
  watched,
  liked,
  commentCount,
  onMute,
  onBlocked,
  onWatched,
  onLike,
  onComments,
  onInfo,
  onGo,
}: ItemProps) {
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [firstFrame, setFirstFrame] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [likeBump, setLikeBump] = useState(0);
  const progress = useSharedValue(0);
  const flash = useSharedValue(0);
  const burst = useSharedValue(0);

  // En quittant la vidéo, tout revient à zéro : elle repartira du début, sans pause oubliée.
  useEffect(() => {
    if (playing) return;
    setPaused(false);
    setStatus('loading');
    setFirstFrame(false);
    progress.value = 0;
  }, [playing, progress]);

  const threshold = Math.min(WATCHED_AFTER_SEC, Math.max(1, video.durationSec - 0.5));
  const onTime = useCallback(
    (current: number, duration: number) => {
      if (duration > 0) {
        progress.value = withTiming(Math.min(1, current / duration), {
          duration: current < 0.3 ? 0 : 250,
          easing: Easing.linear,
        });
      }
      // « Regardée » : quelques secondes de lecture réelle, pas un simple passage.
      if (current >= threshold) onWatched(video.id);
    },
    [progress, threshold, onWatched, video.id],
  );

  const toggle = () => {
    if (status === 'error') return;
    tick();
    setPaused((p) => !p);
    flash.value = withSequence(
      withTiming(1, { duration: 90 }),
      withDelay(260, withTiming(0, { duration: 220 })),
    );
  };

  const like = () => {
    tick();
    setLikeBump((n) => n + 1);
    if (!liked) {
      burst.value = 0;
      burst.value = withSequence(
        withSpring(1, { damping: 9, stiffness: 220 }),
        withDelay(280, withTiming(0, { duration: 240 })),
      );
    }
    onLike(video.id);
  };

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
    transform: [{ scale: 0.8 + flash.value * 0.2 }],
  }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, burst.value * 1.5),
    transform: [{ scale: 0.4 + burst.value * 0.8 }],
  }));

  const poster = mediaSource(video.poster);

  return (
    <View style={{ width, height, backgroundColor: '#000000', overflow: 'hidden' }}>
      {/* Fond : l'affiche de la vidéo, floutée, pour remplir l'écran sans rien recadrer. */}
      <Image
        source={poster}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={28}
        accessible={false}
      />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />

      <View style={[styles.stage, { top, bottom: bottomSpace }]}>
        {/* L'affiche reste visible tant que la première image de la vidéo n'est pas arrivée. */}
        {!firstFrame && (
          <Image
            source={poster}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            accessible={false}
          />
        )}
        {playing && status !== 'error' && (
          <ReelPlayer
            key={attempt}
            video={video}
            muted={muted}
            paused={paused}
            onStatus={setStatus}
            onFirstFrame={() => setFirstFrame(true)}
            onTime={onTime}
            onBlocked={onBlocked}
          />
        )}

        {/* Toute la vidéo est le bouton lecture / pause. */}
        <Pressable
          feedback="none"
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={`${paused ? 'Lire' : 'Mettre en pause'} la vidéo : ${video.title}`}
          style={StyleSheet.absoluteFill}
        />

        {playing && status === 'loading' && (
          <View style={styles.center} accessibilityLiveRegion="polite">
            <View style={styles.loading}>
              <ActivityIndicator color={C.leaf} />
              <Text style={styles.loadingText}>Chargement…</Text>
            </View>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.center}>
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={28} color={C.danger} />
              <Text style={styles.errorTitle}>Lecture impossible</Text>
              <Text style={styles.errorText}>
                La vidéo ne s’est pas chargée. Vérifiez votre connexion, puis réessayez.
              </Text>
              <Pressable
                onPress={() => {
                  setStatus('loading');
                  setFirstFrame(false);
                  setAttempt((n) => n + 1);
                }}
                accessibilityRole="button"
                style={styles.retry}
              >
                <Ionicons name="refresh" size={16} color={C.onLeaf} />
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Retours visuels : lecture / pause, et cœur du J'aime. */}
        <View style={[styles.center, styles.untouchable]}>
          <Animated.View style={[styles.flash, flashStyle]}>
            <Ionicons
              name={paused ? 'pause' : 'play'}
              size={34}
              color={C.text}
              style={paused ? undefined : { marginLeft: 4 }}
            />
          </Animated.View>
        </View>
        {paused && status !== 'error' && (
          <Animated.View
            entering={FadeIn.delay(380).duration(160)}
            exiting={FadeOut.duration(120)}
            style={[styles.center, styles.untouchable]}
          >
            <View style={styles.flash}>
              <Ionicons name="play" size={34} color={C.text} style={{ marginLeft: 4 }} />
            </View>
          </Animated.View>
        )}
        <View style={[styles.center, styles.untouchable]}>
          <Animated.View style={burstStyle}>
            <Ionicons name="heart" size={104} color={C.heart} />
          </Animated.View>
        </View>

        {/* Qui publie, quand, et où en est cette vidéo. Aucun texte de description. */}
        <View style={styles.meta}>
          <View style={[styles.state, !watched && styles.stateNew]}>
            {watched && <Ionicons name="checkmark" size={12} color={C.text} />}
            <Text style={[styles.stateText, !watched && { color: C.onLeaf }]}>
              {watched ? 'Vue' : 'Nouveau'}
            </Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.author} numberOfLines={1}>
              Primeur · l’équipe
            </Text>
            <Text style={styles.date} numberOfLines={1}>
              {formatDay(video.publishedAt)}
              {video.demo ? ' · démo' : ''} · {index + 1}/{count}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Action
            icon={muted ? 'volume-mute' : 'volume-high'}
            label={muted ? 'Muet' : 'Son'}
            a11y={muted ? 'Activer le son' : 'Couper le son'}
            onPress={() => {
              tick();
              onMute();
            }}
          />
          <Action
            icon={liked ? 'heart' : 'heart-outline'}
            label="J’aime"
            a11y={liked ? 'Retirer mon J’aime' : 'J’aime cette vidéo'}
            tint={liked ? C.heart : C.text}
            selected={liked}
            bump={likeBump}
            onPress={like}
          />
          <Action
            icon="chatbubble-ellipses-outline"
            label={commentCount > 0 ? String(commentCount) : 'Avis'}
            a11y={
              commentCount > 0
                ? `Commentaires, ${commentCount} de vous`
                : 'Commentaires, écrire le premier'
            }
            onPress={() => onComments(video.id)}
          />
          <Action
            icon="information-circle-outline"
            a11y="À propos de ces vidéos"
            onPress={onInfo}
          />
          <View style={styles.nav}>
            <Pressable
              onPress={() => onGo(index - 1)}
              disabled={index === 0}
              scaleTo={0.86}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Vidéo précédente"
              accessibilityState={{ disabled: index === 0 }}
              style={[styles.navBtn, index === 0 && { opacity: 0.35 }]}
            >
              <Ionicons name="chevron-up" size={20} color={C.text} />
            </Pressable>
            <Pressable
              onPress={() => onGo(index + 1)}
              scaleTo={0.86}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={index === count - 1 ? 'Fin des vidéos' : 'Vidéo suivante'}
              style={styles.navBtn}
            >
              <Ionicons name="chevron-down" size={20} color={C.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
      </View>
    </View>
  );
});

function Comments({
  video,
  list,
  name,
  onAdd,
  onRemove,
}: {
  video: TeamVideo;
  list: VideoComment[];
  name: string;
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const ready = text.trim().length > 0;
  const send = () => {
    if (!ready) return;
    onAdd(text);
    setText('');
    success();
  };
  return (
    <View>
      <Text style={styles.sheetNote}>
        Démonstration : vos commentaires restent sur cet appareil. Ils ne sont ni publiés, ni
        modérés, ni visibles par d’autres personnes pour l’instant.
      </Text>
      <ScrollView
        style={styles.comments}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {list.length === 0 ? (
          <Text style={styles.noComment}>
            Aucun commentaire sur « {video.title} ». Écrivez le premier.
          </Text>
        ) : (
          list.map((c) => (
            <Animated.View
              key={c.id}
              entering={FadeInDown.duration(220)}
              exiting={FadeOut.duration(140)}
              style={styles.comment}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.commentName}>Vous</Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
              <Pressable
                onPress={() => onRemove(c.id)}
                hitSlop={8}
                scaleTo={0.88}
                accessibilityRole="button"
                accessibilityLabel={`Supprimer mon commentaire : ${c.text}`}
                style={styles.commentRemove}
              >
                <Ionicons name="trash-outline" size={16} color={C.textDim} />
              </Pressable>
            </Animated.View>
          ))
        )}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Votre commentaire"
          placeholderTextColor={C.textFaint}
          style={styles.composerInput}
          maxLength={300}
          returnKeyType="send"
          onSubmitEditing={send}
          accessibilityLabel="Votre commentaire"
        />
        <Pressable
          onPress={send}
          disabled={!ready}
          scaleTo={0.88}
          accessibilityRole="button"
          accessibilityLabel="Envoyer le commentaire"
          accessibilityState={{ disabled: !ready }}
          style={[styles.send, !ready && { opacity: 0.4 }]}
        >
          <Ionicons name="arrow-up" size={20} color={C.onLeaf} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Espace « Découvrir » : les vidéos publiées par l'équipe, plein écran, l'une sous l'autre.
 * Ce n'est pas un fil sans fin : la liste est celle de l'équipe, les nouvelles d'abord, puis
 * celles déjà vues, et elle se termine.
 */
export function Reels({ active, top }: { active: boolean; top: number }) {
  const {
    account,
    videos,
    watched,
    likes,
    comments,
    markWatched,
    toggleLike,
    addComment,
    removeComment,
  } = useStore();
  const { width, bottom } = useFrame();
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const [foreground, setForeground] = useState(true);
  const listRef = useRef<FlatList<Row>>(null);

  // L'ordre est figé à l'ouverture : une vidéo ne change pas de place pendant qu'on la regarde.
  const order = useRef<string[]>([]);
  const rows = useMemo<Row[]>(() => {
    const known = new Set(order.current);
    const fresh = videos.filter((v) => !known.has(v.id));
    if (fresh.length > 0) {
      order.current = [
        ...order.current,
        ...fresh.filter((v) => !watched.includes(v.id)).map((v) => v.id),
        ...fresh.filter((v) => watched.includes(v.id)).map((v) => v.id),
      ];
    }
    const byId = new Map(videos.map((v) => [v.id, v]));
    const list: Row[] = order.current
      .filter((id) => byId.has(id))
      .map((id) => ({ kind: 'video', id, video: byId.get(id) as TeamVideo }));
    return list.length > 0 ? [...list, { kind: 'end', id: '__fin' }] : [];
    // L'ordre ne dépend que de la liste publiée, pas de ce qui est regardé entre-temps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);
  const count = Math.max(0, rows.length - 1);

  // Application en arrière-plan : la vidéo s'arrête.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (height <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.y / height);
      setIndex((current) => (current === next ? current : next));
    },
    [height],
  );
  const go = useCallback(
    (i: number) => {
      const target = Math.max(0, Math.min(rows.length - 1, i));
      listRef.current?.scrollToOffset({ offset: target * height, animated: true });
    },
    [rows.length, height],
  );
  const onMute = useCallback(() => setMuted((m) => !m), []);
  const onBlocked = useCallback(() => setMuted(true), []);
  const onInfo = useCallback(() => setInfo(true), []);

  const current = commentsFor ? videos.find((v) => v.id === commentsFor) : undefined;

  return (
    <View style={styles.root} onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
      {rows.length === 0 ? (
        <View style={{ paddingTop: top + 24 }}>
          <EmptyState
            title="Aucune vidéo pour l’instant"
            body="Les vidéos publiées par notre équipe apparaîtront ici."
          />
        </View>
      ) : height > 0 ? (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(r) => r.id}
          style={PAGE_SCROLL}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          accessibilityLabel="Vidéos de notre équipe"
          renderItem={({ item, index: i }) =>
            item.kind === 'video' ? (
              <ReelItem
                video={item.video}
                index={i}
                count={count}
                width={width}
                height={height}
                top={top}
                bottomSpace={bottom + BAR_SPACE}
                playing={active && foreground && i === index}
                muted={muted}
                watched={watched.includes(item.id)}
                liked={likes.includes(item.id)}
                commentCount={(comments[item.id] ?? []).length}
                onMute={onMute}
                onBlocked={onBlocked}
                onWatched={markWatched}
                onLike={toggleLike}
                onComments={setCommentsFor}
                onInfo={onInfo}
                onGo={go}
              />
            ) : (
              <View
                style={[
                  styles.end,
                  { width, height, paddingTop: top, paddingBottom: bottom + BAR_SPACE },
                ]}
              >
                <Ionicons name="checkmark-done" size={34} color={C.leaf} />
                <Text style={styles.endTitle} accessibilityRole="header">
                  Vous avez tout vu
                </Text>
                <Text style={styles.endText}>
                  {count} vidéo{count > 1 ? 's' : ''} publiée{count > 1 ? 's' : ''} par notre
                  équipe. Il n’y en a pas d’autres pour l’instant : elles restent disponibles ici.
                </Text>
                <PrimaryButton
                  label="Revoir depuis le début"
                  icon="refresh"
                  onPress={() => go(0)}
                  style={{ marginTop: 22, alignSelf: 'stretch' }}
                />
                <Pressable onPress={onInfo} accessibilityRole="button" style={styles.endLink}>
                  <Text style={styles.endLinkText}>Ce qui est une démonstration</Text>
                </Pressable>
              </View>
            )
          }
        />
      ) : null}

      <Sheet visible={!!current} onClose={() => setCommentsFor(null)} title="Commentaires">
        {current && (
          <Comments
            video={current}
            list={comments[current.id] ?? []}
            name={account?.name ?? ''}
            onAdd={(text) => addComment(current.id, text)}
            onRemove={(id) => removeComment(current.id, id)}
          />
        )}
      </Sheet>

      <Sheet visible={info} onClose={() => setInfo(false)} title="À propos de ces vidéos">
        <Text style={styles.infoLine}>
          • Seule notre équipe publie ici. Vous ne pouvez pas publier de vidéo.
        </Text>
        <Text style={styles.infoLine}>
          • Démonstration : ces vidéos sont des exemples montés à partir des photos du catalogue.
          L’outil de publication de l’équipe n’est pas encore connecté.
        </Text>
        <Text style={styles.infoLine}>
          • Une vidéo compte comme vue après {WATCHED_AFTER_SEC} secondes de lecture. Le compteur de
          l’onglet Favoris baisse alors d’une unité.
        </Text>
        <Text style={styles.infoLine}>
          • Vues, J’aime et commentaires sont enregistrés sur cet appareil, pour ce compte. Ils ne
          sont pas transmis à l’équipe, et aucun commentaire n’est publié ni modéré pour l’instant.
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  dim: { backgroundColor: 'rgba(6,8,5,0.62)' },
  stage: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: R.pill,
    backgroundColor: 'rgba(11,14,9,0.78)',
  },
  loadingText: { color: C.text, fontFamily: F.semi, fontSize: 14 },
  errorBox: {
    alignItems: 'center',
    maxWidth: 280,
    padding: 20,
    borderRadius: R.lg,
    backgroundColor: 'rgba(11,14,9,0.9)',
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  errorTitle: { marginTop: 8, color: C.text, fontFamily: F.bold, fontSize: 16 },
  errorText: {
    marginTop: 6,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  retry: {
    marginTop: 14,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: R.pill,
    backgroundColor: C.leaf,
  },
  retryText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 14.5 },
  flash: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,14,9,0.66)',
  },
  untouchable: { pointerEvents: 'none' },
  // La balise vidéo du web ne se cale pas sur ses quatre bords : il lui faut une taille.
  video: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },

  meta: {
    position: 'absolute',
    left: 14,
    top: 10,
    maxWidth: '78%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(11,14,9,0.6)',
    pointerEvents: 'none',
  },
  state: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(245,242,233,0.2)',
  },
  stateNew: { backgroundColor: C.leaf },
  stateText: { color: C.text, fontFamily: F.heavy, fontSize: 11.5 },
  author: { color: C.text, fontFamily: F.bold, fontSize: 13.5, lineHeight: 18 },
  date: { color: 'rgba(245,242,233,0.8)', fontFamily: F.medium, fontSize: 11.5, lineHeight: 15 },

  actions: { position: 'absolute', right: 4, bottom: 14, alignItems: 'center', gap: 8 },
  action: { alignItems: 'center', width: 54 },
  actionDisc: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,14,9,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(245,242,233,0.16)',
  },
  actionLabel: { marginTop: 3, color: C.text, fontFamily: F.bold, fontSize: 11.5 },
  nav: {
    marginTop: 2,
    borderRadius: 24,
    backgroundColor: 'rgba(11,14,9,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(245,242,233,0.16)',
  },
  navBtn: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },

  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(245,242,233,0.2)',
    pointerEvents: 'none',
  },
  fill: { height: 3, backgroundColor: C.leaf },

  end: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: C.bg,
  },
  endTitle: { marginTop: 14, color: C.text, fontFamily: F.display, fontSize: 26, lineHeight: 32 },
  endText: {
    marginTop: 10,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  endLink: { minHeight: 48, justifyContent: 'center', marginTop: 8 },
  endLinkText: {
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 13.5,
    textDecorationLine: 'underline',
  },

  sheetNote: { color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },
  comments: { maxHeight: 240, marginTop: 12 },
  noComment: {
    paddingVertical: 18,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 14.5,
    lineHeight: 21,
  },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  avatarText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 13 },
  commentName: { color: C.textFaint, fontFamily: F.semi, fontSize: 12.5 },
  commentText: { marginTop: 2, color: C.text, fontFamily: F.medium, fontSize: 15, lineHeight: 21 },
  commentRemove: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  composerInput: {
    flex: 1,
    minWidth: 0,
    height: 50,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: C.surface,
    paddingHorizontal: 18,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
  },
  send: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  infoLine: {
    marginBottom: 10,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 14.5,
    lineHeight: 22,
  },
});
