/**
 * Server-action barrel. Every DB mutation lives behind a "use server"
 * function here — never inside a React component.
 */
export { signupAction, loginAction, logoutAction } from "./auth.actions";
export { createCompetition, updateCompetitionStatus } from "./competition.actions";
export { createRoom, updateLiveState, startRoomEvent, startRoomTestMode, joinRoom, setRoomSelectedRounds } from "./room.actions";
export { createTeam, deleteTeam, calculateLeaderboard } from "./team.actions";
export {
  createScene,
  generateScenesForRoom,
  moveScene,
  deleteScene,
  setActiveScene,
} from "./scene.actions";
export { createRound, updateRound, duplicateRound, deleteRound, addQuestionsToRound, removeQuestionFromRound, reorderRoundQuestions } from "./round.actions";
export { createQuestion, updateQuestion, duplicateQuestion, deleteQuestion, attachQuestionToRounds } from "./question.actions";
export { createScoreTransaction, undoScoreTransaction } from "./score.actions";
export { createCoinTransaction, giveCoins, grantStartingCoins } from "./coin.actions";
export {
  createPowerCard,
  updatePowerCard,
  deletePowerCard,
  assignPowerCardsToRoom,
  giveFreeCard,
  purchasePowerCard,
  requestPowerCard,
  approvePowerCard,
  activatePowerCard,
  consumePowerCard,
  openStore,
  closeStore,
  toggleRoomPowerCardOverride,
  hostForceActivatePowerCard,
  hostRemoveTeamPowerCard,
} from "./powerCard.actions";
