"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firebaseDB } from '@/lib/firebase';
import { normalizeTeamGender } from '@/lib/team-gender';
import Image from 'next/image';
import Link from 'next/link';

interface MentionedEntitiesProps {
  htmlContent: string;
  language?: 'en' | 'fr';
}

interface MentionedPlayer {
  id: string;
  label: string;
  firstName?: string;
  lastName?: string;
  teamName?: string;
  number?: string | number;
  headshot?: string;
  position?: string;
  type: 'player';
}

interface MentionedTeam {
  id: string;
  label: string;
  name?: string;
  gender?: 'men' | 'women';
  logo?: string;
  city?: string;
  type: 'team';
}

type MentionedEntity = MentionedPlayer | MentionedTeam;

// Function to unescape HTML entities
const unescapeHtml = (text: string): string => {
  if (typeof document === 'undefined') return text;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

export default function MentionedEntities({ htmlContent, language = 'fr' }: MentionedEntitiesProps) {
  const [entities, setEntities] = useState<MentionedEntity[]>([]);
  const [loading, setLoading] = useState(true);

  // Extract mentions from HTML content
  const rawMentions = useMemo(() => {
    if (!htmlContent) return [];
    
    const text = htmlContent.includes('&lt;') ? unescapeHtml(htmlContent) : htmlContent;
    
    // Match mention spans - check for player type or team type
    // Pattern: data-type="team" or data-type="player" (or no type = player)
    const mentionRegex = /data-id="([^"]*)"[^>]*data-label="([^"]*)"(?:[^>]*data-mention-type="([^"]*)")?/g;
    const result: Array<{ id: string; label: string; type: 'player' | 'team' }> = [];
    let match: RegExpExecArray | null;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const type = match[3] === 'team' ? 'team' : 'player';
      // Avoid duplicates
      if (!result.some(m => m.id === match![1])) {
        result.push({
          id: match[1],
          label: match[2],
          type,
        });
      }
    }
    
    return result;
  }, [htmlContent]);

  // Fetch entity details from Firestore
  useEffect(() => {
    const fetchEntityDetails = async () => {
      if (rawMentions.length === 0) {
        setEntities([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const fetchedEntities: MentionedEntity[] = [];

        const teamsSnapshot = await getDocs(collection(firebaseDB, 'teams'));
        const teamById = new Map(
          teamsSnapshot.docs.map((teamDoc) => [teamDoc.id, teamDoc.data() as Record<string, unknown>])
        );

        const rosterSnapshots = await Promise.all(
          teamsSnapshot.docs.map((teamDoc) =>
            getDocs(collection(firebaseDB, `teams/${teamDoc.id}/roster`)).then((snapshot) => ({
              teamId: teamDoc.id,
              teamData: teamDoc.data() as Record<string, unknown>,
              snapshot,
            }))
          )
        );

        const playerById = new Map<
          string,
          {
            playerData: Record<string, unknown>;
            teamName: string;
          }
        >();

        rosterSnapshots.forEach(({ snapshot, teamData }) => {
          const city = typeof teamData.city === 'string' ? teamData.city : '';
          const name = typeof teamData.name === 'string' ? teamData.name : '';
          const teamName = city ? `${city} ${name}`.trim() : name;

          snapshot.docs.forEach((playerDoc) => {
            if (!playerById.has(playerDoc.id)) {
              playerById.set(playerDoc.id, {
                playerData: playerDoc.data() as Record<string, unknown>,
                teamName,
              });
            }
          });
        });

        rawMentions.forEach((mention) => {
          if (mention.type === 'team') {
            const teamData = teamById.get(mention.id);
            if (teamData) {
              fetchedEntities.push({
                id: mention.id,
                label: mention.label,
                name: typeof teamData.name === 'string' ? teamData.name : undefined,
                logo: typeof teamData.logo === 'string' ? teamData.logo : undefined,
                city: typeof teamData.city === 'string' ? teamData.city : undefined,
                type: 'team',
                gender: normalizeTeamGender(teamData?.gender, teamData?.logo, 'men'),
              });
              return;
            }

            fetchedEntities.push({
              id: mention.id,
              label: mention.label,
              type: 'team',
            });
            return;
          }

          const playerMatch = playerById.get(mention.id);
          if (playerMatch) {
            fetchedEntities.push({
              id: mention.id,
              label: mention.label,
              firstName: typeof playerMatch.playerData.firstName === 'string' ? playerMatch.playerData.firstName : undefined,
              lastName: typeof playerMatch.playerData.lastName === 'string' ? playerMatch.playerData.lastName : undefined,
              teamName: playerMatch.teamName,
              number: (typeof playerMatch.playerData.number === 'string' || typeof playerMatch.playerData.number === 'number')
                ? playerMatch.playerData.number
                : undefined,
              headshot: typeof playerMatch.playerData.headshot === 'string' ? playerMatch.playerData.headshot : undefined,
              position: typeof playerMatch.playerData.position === 'string' ? playerMatch.playerData.position : undefined,
              type: 'player',
            });
            return;
          }

          fetchedEntities.push({
            id: mention.id,
            label: mention.label,
            type: 'player',
          });
        });

        setEntities(fetchedEntities);
      } catch (error) {
        console.error('Error fetching entity details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntityDetails();
  }, [rawMentions]);

  // Don't render if no mentions
  if (rawMentions.length === 0) return null;

  const players = entities.filter(e => e.type === 'player') as MentionedPlayer[];
  const teams = entities.filter(e => e.type === 'team') as MentionedTeam[];

  return (
    <div className="mt-6 pt-6 border-t border-white/10">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          {language === 'fr' ? 'Mentionnés dans cet article' : 'Mentioned in this Article'}
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          {language === 'fr' ? 'Chargement...' : 'Loading...'}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Players */}
          {players.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>👤</span>
                {language === 'fr' ? 'Joueurs' : 'Players'} ({players.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {players.map((player) => (
                  <Link
                    key={player.id}
                    href={player.teamName && player.number ? `/player/${encodeURIComponent(player.teamName)}/${player.number}` : '#'}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all"
                  >
                    {/* Player Avatar */}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                      {player.headshot ? (
                        <Image
                          src={player.headshot}
                          alt={player.label}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                          {player.firstName?.[0] || player.label[0]}
                        </div>
                      )}
                    </div>
                    
                    {/* Player Info */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                        {player.firstName && player.lastName 
                          ? `${player.firstName} ${player.lastName}`
                          : player.label}
                      </p>
                      {player.teamName && (
                        <p className="text-xs text-slate-400 truncate">
                          #{player.number} • {player.teamName}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Teams */}
          {teams.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>🏀</span>
                {language === 'fr' ? 'Équipes' : 'Teams'} ({teams.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {teams.map((team) => (
                  <Link
                    key={team.id}
                    href={
                      team.name
                        ? `/team/${encodeURIComponent(team.city ? `${team.city} ${team.name}` : team.name)}?gender=${team.gender === 'women' ? 'women' : 'men'}`
                        : '#'
                    }
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-orange-500/30 transition-all"
                  >
                    {/* Team Logo */}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                      {team.logo ? (
                        <Image
                          src={team.logo}
                          alt={team.label}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-lg">
                          🏀
                        </div>
                      )}
                    </div>
                    
                    {/* Team Info */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors truncate">
                        {team.city && team.name 
                          ? `${team.city} ${team.name}`
                          : team.name || team.label}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
