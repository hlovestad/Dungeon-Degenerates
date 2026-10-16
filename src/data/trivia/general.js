// "GRAB BAG": the original question bank (easy general knowledge).
import { TRIVIA } from '../trivia.js';
export default TRIVIA.filter((t) => !/Mike|Josh|Dani|Haakon|Landlord/.test(t.q));
