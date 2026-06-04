# All-Star Voting System

## Overview
Mid-season All-Star voting system allowing fans to vote for their favorite players and coaches.

## Voting Limits
- **Men's Players**: 15 maximum
- **Women's Players**: 15 maximum  
- **Men's Coaches**: 2 maximum
- **Women's Coaches**: 2 maximum

## Features
✅ Mobile-first responsive design
✅ Live vote counts displayed on player/coach cards
✅ "Your Team" preview showing top 5 on the floor + bench
✅ Editable votes (users can update their selections)
✅ Vote submission validation
✅ Announcement banner after login
✅ Auto-dismiss banner after voting

## Pages
- `/vote` - Main voting interface
- Banner component appears automatically for logged-in users who haven't voted

## Firestore Structure

### User Votes
```
/allStarVotes/{userId}
  - menPlayers: string[]          // Array of player IDs (max 15)
  - womenPlayers: string[]        // Array of player IDs (max 15)
  - menCoaches: string[]          // Array of coach IDs (max 2)
  - womenCoaches: string[]        // Array of coach IDs (max 2)
  - submittedAt: timestamp        // First submission time
  - lastModified: timestamp       // Last edit time
```

### Vote Results (Aggregated)
```
/allStarVoteResults/menPlayers
  {playerId}: voteCount

/allStarVoteResults/womenPlayers
  {playerId}: voteCount

/allStarVoteResults/menCoaches
  {coachId}: voteCount

/allStarVoteResults/womenCoaches
  {coachId}: voteCount
```

### Banner Dismissal Tracking
```
/allStarVoteConfig/bannerDismissed/users/{userId}
  - dismissed: boolean
  - dismissedAt: timestamp
```

### Vote Configuration (Future)
```
/allStarVoteConfig/settings
  - votingOpen: boolean
  - startDate: timestamp
  - endDate: timestamp
```

## Vote Aggregation
Run the aggregation script periodically to update vote counts:

```bash
node scripts/aggregate-allstar-votes.js
```

This script:
1. Reads all votes from `/allStarVotes`
2. Counts votes for each player/coach
3. Writes aggregated results to `/allStarVoteResults`

## UI/UX Design

### Mobile-First
- Cards are sized for easy tapping on mobile
- Smooth animations and transitions
- Clear visual feedback on selection
- Top 5 players displayed prominently

### Desktop
- Larger grid layout
- More cards visible at once
- Enhanced hover states

### Animations
- Selection bounce effect
- Checkmark overlay on selected cards
- Smooth tab transitions
- Banner slide-in animation

## Security Rules (To Implement)

```javascript
// Allow users to read/write only their own votes
match /allStarVotes/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && 
               request.auth.uid == userId &&
               validateVoteData(request.resource.data);
}

// Allow everyone to read vote results
match /allStarVoteResults/{category} {
  allow read: if true;
  allow write: if false; // Only backend can write
}

function validateVoteData(data) {
  return data.menPlayers.size() == 15 &&
         data.womenPlayers.size() == 15 &&
         data.menCoaches.size() == 2 &&
         data.womenCoaches.size() == 2;
}
```

## Admin Features (Future)
- View all votes
- Download vote data as CSV
- Set voting period dates
- Close/open voting
- View real-time vote analytics

## Testing Checklist
- [ ] Can select players up to limit
- [ ] Cannot exceed selection limit
- [ ] Can deselect players
- [ ] Can switch between Men/Women tabs
- [ ] Selected players appear in "Your Team" preview
- [ ] Top 5 players shown "On the Floor"
- [ ] Bench players shown separately
- [ ] Vote submission works
- [ ] Vote can be edited after submission
- [ ] Banner appears after login
- [ ] Banner dismisses correctly
- [ ] Banner doesn't show after voting
- [ ] Live vote counts display correctly
- [ ] Mobile UI works properly
- [ ] Desktop UI works properly

## Next Steps
1. Test voting flow end-to-end
2. Add vote aggregation Cloud Function
3. Create admin dashboard for vote management
4. Set up automated vote count updates
5. Add voting period date controls
6. Implement security rules
7. Add analytics tracking for votes
