// app/favorites/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import FavoriteCard from '@/components/FavoriteCard';
import { Artwork2 } from '../core/models/types'; // ← используем импортированный тип

type Profile = { id: string; username?: string | null; full_name?: string | null; avatar_url?: string | null; role?: string | null };
type FavRow = { id: string; user_id: string; artwork_id: string; created_at?: string | null };
// Убрали локальное объявление Artwork – теперь везде используем Artwork2

export default function FavoritesPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  // в состоянии rows вместо локального Artwork используем Artwork2
  const [rows, setRows] = useState<Array<{ favId: string; artwork: Artwork2; user?: Profile }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      // 1) кто текущий пользователь
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        if (!mounted) return;
        setError('Пожалуйста, авторизуйтесь чтобы видеть избранное.');
        setLoading(false);
        return;
      }
      const uid = userData.user.id;

      // 2) профиль + роль
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, role')
        .eq('id', uid)
        .single();

      if (profErr) {
        if (!mounted) return;
        setError('Ошибка загрузки профиля.');
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setProfile(prof);

      // 3) получить favorites - если admin то все, иначе только свои
      const favQuery = supabase.from('favorites').select('id, user_id, artwork_id'); // убрали created_at из select, т.к. его нет
      const finalQuery = prof.role === 'admin' ? favQuery : favQuery.eq('user_id', uid);
      const { data: favRows, error: favErr } = await finalQuery; // убрали .order(...)

      if (favErr) {
        if (!mounted) return;
        setError('Ошибка загрузки избранного.');
        setLoading(false);
        return;
      }
      if (!favRows || favRows.length === 0) {
        if (!mounted) return;
        setRows([]);
        setLoading(false);
        return;
      }

      const artworkIds = Array.from(new Set(favRows.map((r: any) => r.artwork_id)));
      const userIds = Array.from(new Set(favRows.map((r: any) => r.user_id)));

      // 4) получить artworks (данные будут соответствовать Artwork2)
      const { data: artworksData, error: artErr } = await supabase
        .from('artworks')
        .select('id, title, image_url, description, author_id')
        .in('id', artworkIds);
      if (artErr) {
        if (!mounted) return;
        setError('Не удалось загрузить работы.');
        setLoading(false);
        return;
      }

      // 5) получить профили пользователей (только если admin)
      let usersData: any[] = [];
      if (prof.role === 'admin') {
        const { data: udata } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        usersData = udata || [];
      }

      const artMap = new Map<string, Artwork2>(); // ← теперь с правильным типом
      (artworksData || []).forEach((a: any) => artMap.set(a.id, a as Artwork2));
      const usersMap = new Map<string, any>();
      (usersData || []).forEach((u: any) => usersMap.set(u.id, u));

      const combined = favRows.map((r: any) => ({
        favId: r.id,
        artwork: artMap.get(r.artwork_id)!,
        user: usersMap.get(r.user_id)
      }));

      if (!mounted) return;
      setRows(combined);
      setLoading(false);
    })();

    return () => { mounted = false; };
  }, []);

  async function handleRemove(favId: string) {
    setDeleting((s) => ({ ...s, [favId]: true }));
    // optimistic update
    const prev = rows;
    setRows((s) => s.filter((r) => r.favId !== favId));

    const { error } = await supabase.from('favorites').delete().eq('id', favId);
    if (error) {
      // rollback
      setRows(prev);
      alert('Не удалось удалить: ' + error.message);
    }
    setDeleting((s) => {
      const n = { ...s };
      delete n[favId];
      return n;
    });
  }

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Избранное</h1>

      {rows.length === 0 ? (
        <div className="text-gray-600">Здесь пока ничего нет.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rows.map((r) => (
            <FavoriteCard
              key={r.favId}
              artwork={r.artwork}
              favId={r.favId}
              showUser={!!profile && profile.role === 'admin'}
              userLabel={r.user ? (r.user.full_name || r.user.username) : null}
              onRemove={handleRemove}
              isDeleting={!!deleting[r.favId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}