/* Block is an abstract class that represents an executable block.
 * Blocks are nearly always contained within BlockStacks or DisplayStacks.
 * Blocks are initially created outside a BlockStacks, but are immediately moved into one.  
 * This is because BlockStacks must always contain at least one Block, so the Block must be created first.
 * @constructor
 * @fix remove the type parameter and use blockShape and instead.
 * @param {number} type - The shape of the Block.  0=Command, 1=Reporter, 2=Predicate, 4=Hat, 5=Loop, 6=DoubleLoop.
 * @param {number} returnType - The type of data the Block returns.  Possible values stored in Block.returnTypes.
 * @param {number} x - The x coord of the Block (relative to the Tab/BlockStack/DisplayStack it is in).
 * @param {number} y - The y coord of the Block.
 * @param {string} category - The Block's category in string form.
 */
function Block(type,returnType,x,y,category){ //Type: 0=Command, 1=Reporter, 2=Predicate Fix! BG
	this.blockTypeName=this.constructor.name; //Keeps track of what type of Block this is.

	this.x=x; //Store coords
	this.y=y;
	this.type=type; //Fix! remove this property
	this.bottomOpen=(type==0||type==4||type==5||type==6); //Can Blocks be attached to the bottom of this Block?
	this.topOpen=(type==0||type==5||type==6); //Can Blocks be attached to the top of this Block?
	this.returnsValue=(returnType!=Block.returnTypes.none); //Does this Block attack to Slots and return a value?
	this.returnType=returnType; //What type of value does this Block return?
	this.hasBlockSlot1=(type==5||type==6); //Is this Block like an if block that has a special BlockSlot?
	this.hasBlockSlot2=(type==6); //Does it have two BlockSlots?
	this.hasHat=(type==4); //Is it a HatBlock?
	
	this.group=GuiElements.create.group(x,y); //Make a group to contain the part of this Block.
	this.parent=null; //A Block's parent is the Block/Slot/BlockSlot that it is attached to.  Currently, it has none.
	this.parts=new Array(); //The parts of a Block include its LabelText, BlockIcons, and Slots.
	this.slots=new Array(); //The slots array just holds the Slots.
	this.running=0; //Running: 0=Not started, 1=Waiting for slots to finish, 2=Running, 3=Completed.
	this.category=category;
	this.isGlowing=false;
	
	this.stack=null; //It has no Stack yet.
	this.path=this.generatePath(); //This path is the main visual part of the Block. It is colored based on category.
	this.height=0; //Will be set later when the Block's dimensions are updated.
	this.width=0;
	this.runMem=function(){}; //serves as a place for the block to store info while running
	if(this.bottomOpen){
		this.nextBlock=null; //Reference to the Block below this one.
	}
	if(this.returnsValue){
		this.resultData=null; //Stores the Data to be passed on to the Slot containing this Block.
	}
	if(this.hasBlockSlot1){
		this.topHeight=0; //The height of just the top of the Block (where the LabelText and Slots are)
		this.blockSlot1=new BlockSlot(this);
	}
	if(this.hasBlockSlot2){
		//The height of the middle part of a DoubleLoopBlock (where the LabelText "else" is on the if/else Block)
		this.midHeight=0;
		this.midLabel=new LabelText(this,this.midLabelText); //The text to appear in the middle section (i.e. "else");
		this.blockSlot2=new BlockSlot(this);
	}
}
/* Sets the possible values for Block.returnTypes.
 */
Block.setConstants=function(){
	Block.returnTypes=function(){};
	Block.returnTypes.none=0; //A command Block always is Block.returnTypes.none.
	Block.returnTypes.num=1;
	Block.returnTypes.string=2;
	Block.returnTypes.bool=3;
	Block.returnTypes.list=4;
};
/* Returns the x coord of the Block relative to the screen (not the group it is contained in).
 * @return {number} - The x coord of the Block relative to the screen.
 */
Block.prototype.getAbsX=function(){
	if(this.stack!=null){
		return this.x+this.stack.getAbsX();
	}
	else{
		return this.x;
	}
};
/* Returns the y coord of the Block relative to the screen.
 * @return {number} - The y coord of the Block relative to the screen.
 */
Block.prototype.getAbsY=function(){
	if(this.stack!=null){
		return this.y+this.stack.getAbsY();
	}
	else{
		return this.y;
	}
};
/* Creates and returns the main SVG path element for the Block.
 * @return {SVG path} - The main SVG path element for the Block.
 */
Block.prototype.generatePath=function(){
	var pathE=BlockGraphics.create.block(this.category,this.group,this.returnsValue);
	TouchReceiver.addListenersChild(pathE,this);
	return pathE;
};
/* Adds a part (LabelText, BlockIcon, or Slot) to the Block.
 * @param {LabelText/BlockIcon/Slot} part - part to add.
 */
Block.prototype.addPart=function(part){
	this.parts.push(part);
	if(part.isSlot){ //Slots are kept track of separately for recursive calls.
		this.slots.push(part);
	}
};
/* Moves the Block and sets its this.x and this.y values.
 * @param {number} x - New x coord.
 * @param {number} y - New y coord.
 */
Block.prototype.move=function(x,y){
	this.x=x;
	this.y=y;
	//All parts of the Block are contained within its group to allow for easy movement.
	GuiElements.move.group(this.group,x,y);
};
/* Recursively stops the Block, its Slots, and any subsequent Blocks.
 */
Block.prototype.stop=function(){
	this.running=0; //Stop this Block.
	for(var i=0;i<this.slots.length;i++){
		this.slots[i].stop(); //Stop this Block's Slots.
	}
	if(this.blockSlot1!=null){
		this.blockSlot1.stop(); //Stop the BlockSlots.
	}
	if(this.blockSlot2!=null){
		this.blockSlot2.stop();
	}
	if(this.bottomOpen&&this.nextBlock!=null){
		this.nextBlock.stop(); //Stop the next Block.
	}
};
/* Updates this currently executing Block and returns if the Block is still running
 * @return {boolean} - Indicates if the Block is still running and should be updated again.
 */
Block.prototype.updateRun=function(){
	//If a Block is told to run and it has not started or believes it is finished (from a previous execution)...
	if(this.running==0||this.running==3){
		for(var i=0;i<this.slots.length;i++){ //...Reset all Slots to prepare for execution.
			this.slots[i].stop();
		}
		this.running=1; //Now the Block is ready to run its Slots.
	}
	var rVal; //The value to return.
	if(this.running==1){ //If the Block is currently waiting on its Slots...
		for(var i=0;i<this.slots.length;i++){
			//Check to see if each Slot is done and update the first Slot that isn't done.
			if(this.slots[i].updateRun()){
				return true; //Still running
			}
		}
		this.running=2; //If all Slots are done running, the Block itself may now run.
		//This function is overridden by the class of the particular Block.
		//It sets the Block up for execution, and if it is a simple Block, may even complete execution.
		rVal = this.startAction();
	}
	else if(this.running==2){ //If the Block is currently running, update it.
		//This function is also overridden and is called repeatedly until the Block is done running.
		rVal = this.updateAction();
	}
	var rT=Block.returnTypes;
	if(rVal==false){ //If the block is done running...
		this.running=3; //Record that the Block is done.
		this.clearMem(); //Clear its runMem to prevent its computations from leaking into subsequent executions.
	}
	return rVal; //Return either the next Block to run or a boolean indicating if this Block is done.
};
/* Will be overridden. Is triggered once when the Block is first executed. Contains the Block's actual behavior.
 * @return {Block/boolean} - The next Block to run or a boolean indicating if it has finished.
 */
Block.prototype.startAction=function(){
	return true; //Still running
};
/* Will be overridden. Is triggered repeatedly until the Block is done running. Contains the Block's actual behavior.
 * @return {Block/boolean} - The next Block to run or a boolean indicating if it has finished.
 */
Block.prototype.updateAction=function(){
	return true; //Still running //Fix! by default this should be false.
};
/* Once the Block is done executing, this function is used by a Slot to retrieve the Block's result.
 * Only used if Block returns a value.
 * Once the Block returns its value, it is done and can reset its state.
 * @return {Data} - The result of the Block's execution.
 */
Block.prototype.getResultData=function(){
	if(this.running==3){ //Only return data if the Block is done running.
		this.running=0; //Reset the Block's state. Prevents same data from ever being re-returned
		return this.resultData; //Access stored result data and return it.
	}
	return null; //If called when the block is not done running, return null. This should never happen.
};
/* Recursively moves the Block, its Slots, and subsequent Blocks to another stack.
 * @param {BlockStack} stack - The stack the Blocks will be moved to.
 */
Block.prototype.changeStack=function(stack){
	this.stack=stack; //Move this Block to the stack
	this.group.remove(); //Remove this Block's SVG group from that of the old stack.
	stack.group.appendChild(this.group); //Add this Block's SVG group to the new stack.
	for(var i=0;i<this.slots.length;i++){
		this.slots[i].changeStack(stack); //Recursively tell this Block's Slots to move thir children to the new stack.
	}
	if(this.nextBlock!=null){
		this.nextBlock.changeStack(stack); //Tell the next block to move.
	}
	if(this.blockSlot1!=null){
		this.blockSlot1.changeStack(stack); //If this block is a loop/if tell its contents to move.
	}
	if(this.blockSlot2!=null){
		this.blockSlot2.changeStack(stack); //If it has a second BlockSlot, move it too.
	}
};
/* Each BlockStack keeps track of its bounding rectangle.  This function recursively tells the Blocks to update it.
 * Each Block checks to see if it is outside the proposed bounding rectangle and if so adjusts it.
 * This function just handles the recursive part. The actual checks and adjustment are handled by updateStackDimO
 */
Block.prototype.updateStackDim=function(){
	//Slots are updated separately by updateStackDimRI.
	if(this.blockSlot1!=null){
		this.blockSlot1.updateStackDim(); //If this block is a loop/if tell its contents to update.
	}
	if(this.blockSlot2!=null){
		this.blockSlot2.updateStackDim(); //If it has a second BlockSlot, update it too.
	}
	this.updateStackDimRI(); //Update the stack dimensions using information from this Block.
	if(this.nextBlock!=null){
		this.nextBlock.updateStackDim(); //Tell the next block to update.
	}
};
/* Handles more of the recursion for updateStackDim.
 * RI stands for Recursive Inside.  RI functions update slots but not subsequent Blocks or BlockSlots.
 * This allows other functions to avoid unnecessary updates when full recursion is not needed.
 * updateStackDimO handled the actual updates.
 */
Block.prototype.updateStackDimRI=function(){
	for(var i=0;i<this.slots.length;i++){
		this.slots[i].updateStackDim(); //Pass message on to Slots.
	}
	this.updateStackDimO(); //Update this Block.
};
/* Checks to see if the Block is outside the bounding box of its Stack and if so adjusts it.
 * It is called recursively by updateStackDim and updateStackDimRI.
 * The stack has two bounding boxes. Both are used when looking for potential Blocks to snap to.
 * Reporters/predicates can snap to the large r bounding box.
 * Commands can snap to the smaller c bounding box.
 * (the r box is larger because they can be snapped to the middle of other blocks while command blocks can't)
 * The point of stack bounding boxes is that when looking for potential Blocks to snap only those inside a matching
 * stack have to be investigated.
 */
Block.prototype.updateStackDimO=function(){
	var sDim=this.stack.dim; //Loads the stack's dimension data.
	var snap=BlockGraphics.command.snap; //Loads the snap bounding box for command blocks.
	if(this.bottomOpen||this.topOpen){ //Only update the c box if this is a command block //Fix! use !this.returnsValue
		var cx1=this.x-snap.left; //Create bounding rectangle for this particular command Block
		var cy1=this.y-snap.top;
		var cx2=this.x+snap.right;
		var cy2=this.y+this.height+snap.bottom;
		if(cx1<sDim.cx1){ //If the edge of the Block is outside the stack, adjust the stack's dims.
			sDim.cx1=cx1;
		}
		if(cy1<sDim.cy1){
			sDim.cy1=cy1;
		}
		if(cx2>sDim.cx2){
			sDim.cx2=cx2;
		}
		if(cy2>sDim.cy2){
			sDim.cy2=cy2;
		}
	}
	var rx1=this.x; //The r bounding box is just the size of the Block itself.
	var ry1=this.y;
	var rx2=this.x+this.width;
	var ry2=this.y+this.height;
	if(rx1<sDim.rx1){ //If the edge of the Block is outside the stack, adjust the stack's dims.
		sDim.rx1=rx1;
	}
	if(ry1<sDim.ry1){
		sDim.ry1=ry1;
	}
	if(rx2>sDim.rx2){
		sDim.rx2=rx2;
	}
	if(ry2>sDim.ry2){
		sDim.ry2=ry2;
	}
	//The Stacks dimensions now include the Block.
	//Note that the r box is also the visual bounding box of the stack as well as the reporter snap bounding box.
};
/* Recursively adjusts the sizes of all the parts of the Block (Slots, children, labels, etc.)
 * It does not move the parts, however.  That is done later using updateAlign once the sizing is finished.
 */
Block.prototype.updateDim=function(){
	var bG=BlockGraphics.getType(this.type); //Fix! loads dimension data from BlockGraphics.
	if(this.topOpen||this.bottomOpen){ //If this is a command block, then use the BlockGraphics for command blocks.
		bG=BlockGraphics.command; //If the block if a Loop or DoubleLoop, use the CommandBlock dimension instead.
	}
	var width=0;
	width+=bG.hMargin; //The left margin of the Block.
	var height=0;
	for(var i=0;i<this.parts.length;i++){
		this.parts[i].updateDim(); //Tell all parts of the Block to update before using their widths for calculations.
		width+=this.parts[i].width; //Fill the width of the middle of the Block
		if(this.parts[i].height>height){ //The height of the Block is the height of the tallest member.
			height=this.parts[i].height;
		}
		if(i<this.parts.length-1){
			width+=BlockGraphics.block.pMargin; //Add "part margin" between parts of the Block.
		}
	}
	width+=bG.hMargin; //Add the right margin of the Block.
	height+=2*bG.vMargin; //Add the bottom and top margins of the Block.
	if(height<bG.height){ //If the height is less than the min height, fix it.
		height=bG.height;
	}
	if(this.hasBlockSlot1){ //If it has a BlockSlot update that.
		this.topHeight=height; //The topHeight is the height of everything avove the BlockSlot.
		this.blockSlot1.updateDim(); //Update the BlockSlot.
		height+=this.blockSlot1.height; //The total height, however, includes the BlockSlot.
		height+=BlockGraphics.loop.bottomH; //It also includes the bottom part of the loop.
	}
	if(this.hasBlockSlot2){ //If the Block has a second BlockSlot...
		this.midLabel.updateDim(); //Update the label in between the two BlockSlots.
		this.midHeight=this.midLabel.height; //Add the Label's height to the total.
		this.midHeight+=2*bG.vMargin; //The height between the BlockSlots also includes the margin of that area.
		if(this.midHeight<bG.height){ //If it's less than the minimum, adjust it.
			this.midHeight=bG.height;
		}
		height+=this.midHeight; //Add the midHeight to the total.
		this.blockSlot2.updateDim(); //Update the secodn BlockSlot.
		height+=this.blockSlot2.height; //Add its height to the total.
	}
	//If the Block was a loop or DoubleLoop now we are dealing with its actual properties (not those of command)
	bG=BlockGraphics.getType(this.type);
	if(width<bG.width){ //If it is less than the minimum width, adjust it.
		width=bG.width;
	}
	this.resize(width,height); //Resize this Block to the new widths.
	if(this.nextBlock!=null){
		this.nextBlock.updateDim(); //Pass the message to the next Block.
	}
};
/* Recursively adjusts the positioning of all the parts of the Block (Slots, children, labels, etc.)
 * The BlockStack calls this function after the updateDim function, so all sizes are correct.
 * @param {number} x - The x coord this block should have when completed.
 * @param {number} y - The y coord the block should have.
 * @return {number} - The width of the current block, indicating how much the x should shift over.
 * y is measured from the top for all Blocks, x is measured from the left.
 */
Block.prototype.updateAlign=function(x,y){
	var bG=BlockGraphics;
	this.updateAlignRI(x,y); //Update recursively within the block.
	if(this.hasBlockSlot1){ //Then tell all susequent blocks to align.
		this.blockSlot1.updateAlign(this.x+bG.loop.side,this.y+this.topHeight);
	}
	if(this.hasBlockSlot2){
		this.blockSlot2.updateAlign(this.x+bG.loop.side,this.y+this.topHeight+this.blockSlot1.height+this.midHeight);
		this.midLabel.updateAlign(bG.loop.side,this.topHeight+this.blockSlot1.height+this.midHeight/2);
	}
	if(this.nextBlock!=null){
		this.nextBlock.updateAlign(this.x,this.y+this.height);
	}
	return this.width;
};
/* Adjusts the positioning of the Block's internal parts.  Recursively updates their children.
 * @param {number} x - The x coord this block should have when completed.
 * @param {number} y - The y coord the block should have.
 * y is measured from the top for all Blocks, x is measured from the left.
 */
Block.prototype.updateAlignRI=function(x,y){
	this.move(x,y); //Move to the desired location
	var bG=BlockGraphics.getType(this.type);
	var yCoord=this.height/2; //Compute coords for internal parts.
	var xCoord=0;
	if(this.hasBlockSlot1){
		yCoord=this.topHeight/2; //Internal parts measure their y coords from the center of the block.
	}
	if(this.bottomOpen||this.topOpen){
		bG=BlockGraphics.command;
	}
	xCoord+=bG.hMargin;
	for(var i=0;i<this.parts.length;i++){
		xCoord+=this.parts[i].updateAlign(xCoord,yCoord); //As each element is adjusted, shift over by the space used.
		if(i<this.parts.length-1){
			xCoord+=BlockGraphics.block.pMargin;
		}
	}
};
/* Resizes the path of the Block to the specified width and height.  The sizes of its BlockSlots are also considered.
 * @param {number} width - The desired width of the Block.
 * @param {number} height - The desired height of the Block.
 */
Block.prototype.resize=function(width,height){
	var BG=BlockGraphics;
	//First set width and height properties.
	this.width=width;
	this.height=height;
	//Then collect other necessary information.
	var innerHeight1=0;
	var innerHeight2=0;
	var midHeight=0;
	if(this.hasBlockSlot1){
		innerHeight1=this.blockSlot1.height;
	}
	if(this.hasBlockSlot2){
		innerHeight2=this.blockSlot2.height;
		midHeight=this.midHeight;
	}
	//Tell BlockGraphics to change the path description to match the new properties.
	BG.update.path(this.path,0,0,width,height,this.type,false,innerHeight1,innerHeight2,midHeight,this.bottomOpen);
};
/* Recursively searches for the Block with best fits the currently moving BlockStack.
 * Stores information about any matches in CodeManager.fit and uses data from CodeManager.move.
 * A command block attempts to find a connection between its bottom and the moving stack's top.
 * Connections to the top of the stack's findBestFit.
 */
Block.prototype.findBestFit=function(){
	var move=CodeManager.move;
	var fit=CodeManager.fit;
	var x=this.getAbsX(); //Get coords to compare.
	var y=this.getAbsY();
	if(move.topOpen&&this.bottomOpen){ //If a connection between the stack and block are possible...
		var snap=BlockGraphics.command.snap; //Load snap bounding box
		//see if corner of moving block falls within the snap bounding box.
		var snapBLeft=x-snap.left;
		var snapBTop=y-snap.top;
		var snapBWidth=snap.left+snap.right;
		var snapBHeight=snap.top+this.height+snap.bottom;
		//Check if point falls in a rectangular range.
		if(move.pInRange(move.topX,move.topY,snapBLeft,snapBTop,snapBWidth,snapBHeight)){
			var xDist=move.topX-x; //If it does, compute the distance with the distance formula.
			var yDist=move.topY-(y+this.height);
			var dist=xDist*xDist+yDist*yDist; //Technically this is the distance^2.
			if(!fit.found||dist<fit.dist){ //See if this fit is closer than the current best fit.
				fit.found=true; //If so, save it and other helpful infromation.
				fit.bestFit=this;
				fit.dist=dist;
			}
		}
	}
	if(move.returnsValue){ //If the moving stack returns a value, see if it fits in any slots.
		for(var i=0;i<this.slots.length;i++){
			this.slots[i].findBestFit();
		}
	}
	if(this.hasBlockSlot1){ //Pass the message on recursively.
		this.blockSlot1.findBestFit();
	}
	if(this.hasBlockSlot2){
		this.blockSlot2.findBestFit();
	}
	if(this.nextBlock!=null){
		this.nextBlock.findBestFit();
	}
};
/* Adds an indicator showing that the moving BlockStack will snap onto this Block if released.
 * The indicator is a different color/shape depending on the Block's type and if it is running.
 */
Block.prototype.highlight=function(){
	if(this.bottomOpen){
		Highlighter.highlight(this.getAbsX(),this.getAbsY()+this.height,this.width,this.height,0,false,this.isGlowing);
	}
	else{ //If a block returns a value, the BlockStack can only attach to one of its slots, not the Block itself.
		GuiElements.throwError("Error: attempt to highlight block that has bottomOpen=false");
	}
};
/* Attaches the provided Block (and all subsequent Block's) to the bottom of this Block. Then runs updateDim();
 * @param {Block} block - The first Block in the stack to attach to this Block.
 */
Block.prototype.snap=function(block){ //Fix! documentation
	//If the Block cannot have other blocks below it, any other blocks must now be disconnected.
	var bottomStackBlock=block.getLastBlock(); //The bottom Block in the stack to be inserted.
	if(!bottomStackBlock.bottomOpen&&this.nextBlock!=null){
		var bG=BlockGraphics.command;
		this.nextBlock.unsnap().shiftOver(bG.shiftX,block.stack.getHeight()+bG.shiftY);
	}
	var stack=this.stack;
	if(block.stack!=null) {
		if (stack.isRunning && !block.stack.isRunning) { //Fix! remove duplicate code.
			block.glow();
		}
		else if (!stack.isRunning && block.stack.isRunning) { //Blocks that are added are stopped.
			block.stack.stop();
		}
		else if (stack.isRunning && block.isRunning) { //The added block is stopped, but still glows as part of a running stack.
			block.stop();
		}
	}
	var upperBlock=this; //The Block which will go above the inserted stack.
	var lowerBlock=this.nextBlock;//The Block which will go below the inserted stack. Might be null.
	var topStackBlock=block; //The top Block in the stack to be inserted.

	//The top of where the stack is inserted note which Blocks are above/below them.
	upperBlock.nextBlock=topStackBlock;
	topStackBlock.parent=upperBlock;
	//The bottom of where the stack is inserted does the same.
	bottomStackBlock.nextBlock=lowerBlock;
	if(lowerBlock!=null){ //There might not be a Block below the inserted stack.
		lowerBlock.parent=bottomStackBlock;
	}
	var oldG=null;
	if(block.stack!=null) {
		oldG=block.stack.group; //Get a handle to the old stack's group
		block.stack.remove(); //Remove the old stack.
	}
	if(this.stack!=null) {
		block.changeStack(this.stack); //Move the block over into this stack
	}
	if(oldG!=null) {
		oldG.remove(); //Remove the old stack's group.
	}
	if(this.stack!=null) {
		this.stack.updateDim(); //Update the dimensions now that the movement is complete.
	}
};
/* Disconnects this Block from the Blocks above it and returns the new;y-created BlockStack. Calls updateDim on parent.
 * @return {BlockStack} - A BlockStack containing this Block and all subsequent Blocks.
 */
Block.prototype.unsnap=function(){
	//If this has a parent, then it needs to disconnect and make a new stack.  Otherwise, it returns its current stack.
	if(this.parent!=null){
		if(this.parent.isSlot||this.parent.isBlockSlot){ //Sees if it is attached to a Slot not another Block.
			this.parent.removeChild(); //Leave the Slot.
			this.parent.parent.stack.updateDim(); //Tell the stack the Slot belongs to to update its dimensions.
		}
		else{ //This Block is connected to another Block.
			this.parent.nextBlock=null; //Disconnect from parent Block.
			this.parent.stack.updateDim(); //Tell parent's stack to update dimensions.
		}
		this.parent=null; //Delete reference to parent Block/Slot/BlockSlot.
		//Make a new BlockStack with this Block in current Tab.  Also moves over any subsequent Blocks.
		return new BlockStack(this,this.stack.getTab());
	}
	//If the Block already had no parent, just return this Block's stack.
	return this.stack;
};
/* Recursively finds and returns the last Block in this BlockStack.
 * @return {Block} - The last Block in this BlockStack.
 */
Block.prototype.getLastBlock=function(obj){
	if(this.nextBlock==null){
		return this; //This Block is the last one.
	}
	else{
		return this.nextBlock.getLastBlock(); //Try the next Block.
	}
};
/* Recursively returns the height of this Block and all subsequent Blocks. Used by BlockSlots to determine height.
 * @return {number} - The height of this Block and all subsequent Blocks.
 */
Block.prototype.addHeights=function(){
	if(this.nextBlock!=null){
		return this.height+this.nextBlock.addHeights(); //Return this Block's height plus those below it.
	}
	else{
		return this.height; //This is the last Block. Return its height.
	}
};
/* Returns a copy of this Block, its Slots, subsequent Blocks, and nested Blocks. Uses Recursion.
 * @return {Block} - This Block's copy.
 */
Block.prototype.duplicate=function(x,y){
	//Uses the constructor of the Block class but has the methods of this specific Block's subclass.
	//Allows the Block to be constructed without any Slots initially, so they can be duplicated and added on.
	var copiedClass=function(type,returnType,x1,y1,category){
		Block.call(this,type,returnType,x1,y1,category); //Call Block constructor.
	};
	copiedClass.prototype = Object.create(this.constructor.prototype); //Copy all functions.
	copiedClass.prototype.constructor = copiedClass; //Only constructor differs.

	var myCopy=new copiedClass(this.type,this.returnType,x,y,this.category); //Make an empty Block of this Block's type.
	myCopy.blockTypeName=this.blockTypeName;
	for(var i=0;i<this.parts.length;i++){ //Copy this Block's parts to the new Block.
		myCopy.addPart(this.parts[i].duplicate(myCopy));
	}
	if(this.blockSlot1!=null){ //Copy the contents of its Slots.
		myCopy.blockSlot1=this.blockSlot1.duplicate(myCopy);
	}
	if(this.blockSlot2!=null){
		myCopy.blockSlot2=this.blockSlot2.duplicate(myCopy);
	}
	if(this.nextBlock!=null){ //Copy subsequent Blocks.
		myCopy.nextBlock=this.nextBlock.duplicate(0,0);
		myCopy.nextBlock.parent=myCopy;
	}
	if(this.variable!=null){ //Copy variable data if this is a variable Block.
		myCopy.variable=this.variable;
	}
	if(this.list!=null){ //Copy list data if this is a list Block.
		myCopy.list=this.list;
	}
	myCopy.bottomOpen=this.bottomOpen; //Set properties not set by constructor.
	return myCopy; //Return finished Block.
};
/* Returns an entirely text-based version of the Block for display in dialogs.
 * May exclude a slot and replace if with "___".
 * @param {Slot} slotToExclude - (optional) The Slot to replace with "___".
 * @return {string} - The finished text summary.
 */
Block.prototype.textSummary=function(slotToExclude){
	var summary="";
	for(var i=0;i<this.parts.length;i++){
		if(this.parts[i]==slotToExclude){
			summary+="___"; //Replace slot with underscores.
		}
		else{
			summary+=this.parts[i].textSummary(); //Recursively build text summary from text summary of contents.
		}
		if(i<this.parts.length-1){ //Add space between part descriptions.
			summary+=" ";
		}
	}
	return summary;
};
/* Overridden by subclasses. Alerts Block that the flag was clicked. Most Blocks won't respond to this directly.
 */
Block.prototype.eventFlagClicked=function(){
	
};
/* Overridden by subclasses. Passes broadcast message to Block. */
Block.prototype.eventBroadcast=function(message){

};
/* Overridden by subclasses. Passes broadcast message to Block. */
Block.prototype.checkBroadcastRunning=function(message){
	return false;
};
/* Recursively checks if a given message is still in use by any of the DropSlots. */
Block.prototype.checkBroadcastMessageAvailable=function(message){
	for(var i=0;i<this.slots.length;i++){
		if(this.slots[i].checkBroadcastMessageAvailable(message)){
			return true;
		}
	}
	if(this.blockSlot1!=null){
		if(this.blockSlot1.checkBroadcastMessageAvailable(message)){
			return true;
		}
	}
	if(this.blockSlot2!=null){
		if(this.blockSlot2.checkBroadcastMessageAvailable(message)){
			return true;
		}
	}
	if(this.bottomOpen&&this.nextBlock!=null){
		if(this.nextBlock.checkBroadcastMessageAvailable(message)){
			return true;
		}
	}
	return false;
};
/* Recursively updates the available broadcast messages.
 */
Block.prototype.updateAvailableMessages=function(){
	for(var i=0;i<this.slots.length;i++){
		this.slots[i].updateAvailableMessages();
	}
	if(this.blockSlot1!=null){
		this.blockSlot1.updateAvailableMessages();
	}
	if(this.blockSlot2!=null){
		this.blockSlot2.updateAvailableMessages();
	}
	if(this.bottomOpen&&this.nextBlock!=null){
		this.nextBlock.updateAvailableMessages();
	}
};
/* Deletes the Block's running memory (memory reserved for computations related to execution)
 */
Block.prototype.clearMem=function(){
	this.runMem=new function(){}; //Delete all runMem.
	for(var i=0;i<this.slots.length;i++){ //NOT recursive.
		this.slots[i].clearMem(); //Removes resultData and resets running state to 0.
	}
};
/* Returns the result of the Block's execution.
 * The data is then removed to prevent the result from being returned again.
 */
Block.prototype.getResultData=function(){
	var result=this.resultData;
	this.resultData=null;
	return result;
};
/* Recursively adds a white outline to indicate that the BlockStack is running. */
Block.prototype.glow=function(){
	BlockGraphics.update.glow(this.path);
	this.isGlowing=true; //Used by other classes to determine things like highlight color.
	if(this.blockSlot1!=null){
		this.blockSlot1.glow();
	}
	if(this.blockSlot2!=null){
		this.blockSlot2.glow();
	}
	if(this.bottomOpen&&this.nextBlock!=null){
		this.nextBlock.glow();
	}
};
/* Recursively removes the outline. */
Block.prototype.stopGlow=function(){
	BlockGraphics.update.stroke(this.path,this.category,this.returnsValue);
	this.isGlowing=false;
	if(this.blockSlot1!=null){
		this.blockSlot1.stopGlow();
	}
	if(this.blockSlot2!=null){
		this.blockSlot2.stopGlow();
	}
	if(this.bottomOpen&&this.nextBlock!=null){
		this.nextBlock.stopGlow();
	}
};

Block.prototype.writeToXml=function(xmlDoc,xmlBlocks){
	xmlBlocks.appendChild(this.createXml(xmlDoc));
	if(this.bottomOpen&&this.nextBlock!=null){
		this.nextBlock.writeToXml(xmlDoc,xmlBlocks);
	}
};
Block.prototype.createXml=function(xmlDoc){
	var block=XmlWriter.createElement(xmlDoc,"block");
	XmlWriter.setAttribute(block,"type",this.blockTypeName);
	var slots=XmlWriter.createElement(xmlDoc,"slots");
	for(var i=0;i<this.slots.length;i++){
		slots.appendChild(this.slots[i].createXml(xmlDoc));
	}
	block.appendChild(slots);
	if(this.blockSlot1!=null){
		var blockSlots=XmlWriter.createElement(xmlDoc,"blockSlots");
		blockSlots.appendChild(this.blockSlot1.createXml(xmlDoc));
		if(this.blockSlot2!=null){
			blockSlots.appendChild(this.blockSlot2.createXml(xmlDoc));
		}
		block.appendChild(blockSlots);
	}
	return block;
};
Block.importXml=function(blockNode){
	var type=XmlWriter.getAttribute(blockNode,"type");
	var block;
	try {
		if (type.substring(0, 2) == "B_") {
			if(window[type].importXml!=null){
				return window[type].importXml(blockNode);
			}
			else {
				block = new window[type](0, 0);
			}
		}
		else{
			return null;
		}
	}
	catch(e) {
		return null;
	}
	var slotsNode=XmlWriter.findSubElement(blockNode,"slots");
	var slotNodes=XmlWriter.findSubElements(slotsNode,"slot");
	for(var i=0;i<slotNodes.length&&i<block.slots.length;i++){
		block.slots[i].importXml(slotNodes[i]);
	}
	var blockSlotsNode=XmlWriter.findSubElement(blockNode,"blockSlots");
	var blockSlotNodes=XmlWriter.findSubElements(blockSlotsNode,"blockSlot");
	if(block.blockSlot1!=null&&blockSlotNodes.length>=1){
		block.blockSlot1.importXml(blockSlotNodes[0]);
	}
	if(block.blockSlot2!=null&&blockSlotNodes.length>=2){
		block.blockSlot2.importXml(blockSlotNodes[1]);
	}
	return block;
};
Block.prototype.renameVariable=function(variable){
	this.passRecursively("renameVariable",variable);
};
Block.prototype.deleteVariable=function(variable){
	this.passRecursively("deleteVariable",variable);
};
Block.prototype.renameList=function(list){
	this.passRecursively("renameList",list);
};
Block.prototype.deleteList=function(list){
	this.passRecursively("deleteList",list);
};
Block.prototype.checkVariableUsed=function(variable){
	for(var i=0;i<this.slots.length;i++){
		if(this.slots[i].checkVariableUsed(variable)){
			return true;
		}
	}
	if(this.blockSlot1!=null){
		if(this.blockSlot1.checkVariableUsed(variable)){
			return true;
		}
	}
	if(this.blockSlot2!=null){
		if(this.blockSlot2.checkVariableUsed(variable)){
			return true;
		}
	}
	if(this.bottomOpen&&this.nextBlock!=null){
		if(this.nextBlock.checkVariableUsed(variable)){
			return true;
		}
	}
	return false;
};
Block.prototype.checkListUsed=function(list){
	for(var i=0;i<this.slots.length;i++){
		if(this.slots[i].checkListUsed(list)){
			return true;
		}
	}
	if(this.blockSlot1!=null){
		if(this.blockSlot1.checkListUsed(list)){
			return true;
		}
	}
	if(this.blockSlot2!=null){
		if(this.blockSlot2.checkListUsed(list)){
			return true;
		}
	}
	if(this.bottomOpen&&this.nextBlock!=null){
		if(this.nextBlock.checkListUsed(list)){
			return true;
		}
	}
	return false;
};
Block.prototype.hideHBDropDowns=function(){
	this.passRecursively("hideHBDropDowns");
};
Block.prototype.showHBDropDowns=function(){
	this.passRecursively("showHBDropDowns");
};
Block.prototype.countHBsInUse=function(){
	var largest=1;
	for(var i=0;i<this.slots.length;i++){
		largest=Math.max(largest,this.slots[i].countHBsInUse());
	}
	if(this.blockSlot1!=null){
		largest=Math.max(largest,this.blockSlot1.countHBsInUse());
	}
	if(this.blockSlot2!=null){
		largest=Math.max(largest,this.blockSlot2.countHBsInUse());
	}
	if(this.bottomOpen&&this.nextBlock!=null){
		largest=Math.max(largest,this.nextBlock.countHBsInUse());
	}
	return largest;
};
Block.prototype.passRecursively=function(functionName){
	var args = Array.prototype.slice.call(arguments, 1);
	for(var i=0;i<this.slots.length;i++){
		var currentSlot=this.slots[i];
		currentSlot[functionName].apply(currentSlot,args);
	}
	if(this.blockSlot1!=null){
		this.blockSlot1[functionName].apply(this.blockSlot1,args);
	}
	if(this.blockSlot2!=null){
		this.blockSlot2[functionName].apply(this.blockSlot2,args);
	}
	if(this.bottomOpen&&this.nextBlock!=null){
		this.nextBlock[functionName].apply(this.nextBlock,args);
	}
};