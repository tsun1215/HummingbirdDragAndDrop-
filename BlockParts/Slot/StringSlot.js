/* StringSlot is a subclass of RectSlot.
 * It creates a RectSlot optimized for use with strings.
 * It automatically converts any results into StringData and has a snapType of numStr.
 * @constructor
 * @param {Block} parent - The Block this Slot is a part of.
 * @param {string} value - The initial string stored in the Slot.
 */
function StringSlot(parent,value){
	//Make RectSlot.
	RectSlot.call(this,parent,Slot.snapTypes.numStr,Slot.outputTypes.string,value);
}
StringSlot.prototype = Object.create(RectSlot.prototype);
StringSlot.prototype.constructor = StringSlot;