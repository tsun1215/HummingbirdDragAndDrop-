/* CodeManager is a static class that controls block execution.
 * It also moves the BlockStack that the user is dragging.
 */
function CodeManager(){
	var move=CodeManager.move; //shorthand
	move.moving=false; //Is there a BlockStack that is currently moving?
	move.stack=null; //Reference to BlockStack that is currently moving.
	move.offsetX=0; //The difference between the BlockStack's x and the touch x.
	move.offsetY=0; //The difference between the BlockStack's y and the touch y.
	move.touchX=0; //The x coord of the user's finger.
	move.touchY=0; //The y coord of the user's finger.
	move.topX=0; //The top-left corner's x coord of the BlockStack being moved.
	move.topY=0; //The top-left corner's y-coord of the BlockStack being moved.
	move.height=0; //The height of the BlockStack (used to determine overlap with slots).
	move.width=0; //The width of the BlockStack.
	//The return type of the BlockStack. (none unless it is a reporter, predicate, etc.)
	move.returnType;

	CodeManager.variableList=new Array();
	CodeManager.listList=new Array();
	CodeManager.broadcastList=new Array(); //A list of broadcast messages in use.
	CodeManager.isRunning=false; //Are at least some Blocks currently executing?
	//Stores information used when determine which slot is closest to the moving stack.
	CodeManager.fit=function(){};
	CodeManager.updateTimer=null; //A timer which tells executing Blocks to update.
	CodeManager.updateInterval=10; //How quickly does the update timer fire (in ms)?
	//Stores the answer to the "ask" block. When the app first opens, the answer is an empty string.
	CodeManager.answer=new StringData("");
	CodeManager.message=new StringData(""); //Stores the broadcast message.
	CodeManager.sound=function(){};
	CodeManager.sound.tempo=60; //Default tempo is 60 bpm for sound blocks.
	CodeManager.sound.volume=50; //Default volume if 50%.
	//Successive prompt dialogs have a time delay to give time for the user to stop the program.
	CodeManager.repeatDialogDelay=500;
	CodeManager.lastDialogDisplayTime=null;
	CodeManager.repeatHBOutDelay=67;
	CodeManager.reservedStackHBoutput=null;
	CodeManager.lastHBOutputSendTime=null;
	CodeManager.timerForSensingBlock=new Date().getTime(); //Initialize the timer to the current time.
}
/* CodeManager.move contains function to start, stop, and update the movement of a BlockStack.
 * These functions are called by the TouchReciever class when the user drags a BlockStack.
 */
CodeManager.move=function(){};
/* Picks up a Block so that it can be moved.  Stores necessary information in CodeManager.move.
 * Transfers the BlockStack into the drag layer above other blocks.
 * @param {Block} block - The block the user dragged.
 * @param {number} x - The x coord of the user's finger.
 * @param {number} y - The y coord of the user's finger.
 */
CodeManager.move.start=function(block,x,y){
	var move=CodeManager.move; //shorthand
	if(!move.moving){ //Only start moving the Block if no other Blocks are moving.
		GuiElements.overlay.close(); //Close any visible overlays.
		move.moving=true; //Record that a Block is now moving.
		/* Disconnect the Block from its current BlockStack to form a new BlockStack 
		containing only the Block and the Blocks below it. */
		var stack=block.unsnap();
		stack.fly(); //Make the new BlockStack fly (moves it into the drag layer).
		move.height=stack.dim.rh; //Store the BlockStack's dimensions.
		move.width=stack.dim.rw;
		move.returnType=stack.returnType; //Store the BlockStack's return type.
		
		//Store other information about how the BlockStack can connect to other Blocks.
		move.bottomOpen=stack.getLastBlock().bottomOpen;
		move.topOpen=stack.firstBlock.topOpen;
		move.returnsValue=stack.firstBlock.returnsValue;
		//move.hasBlockSlot1=stack.firstBlock.hasBlockSlot1;
		//move.hasBlockSlot2=stack.firstBlock.hasBlockSlot2;

		move.touchX=x; //Store coords
		move.touchY=y;
		move.offsetX=stack.getAbsX()-x; //Store offset.
		move.offsetY=stack.getAbsY()-y;
		move.stack=stack; //Store stack.
	}
}
/* Updates the position of the currently moving BlockStack.  
 * Also highlights the slot that fits it best (if any).
 * @param {number} x - The x coord of the user's finger.
 * @param {number} y - The y coord of the user's finger.
 */
CodeManager.move.update=function(x,y){
	var move=CodeManager.move; //shorthand
	if(move.moving){ //Only update if a BlockStack is currently moving.
		move.touchX=x;
		move.touchY=y;
		move.topX=move.offsetX+move.touchX;
		move.topY=move.offsetY+move.touchY;
		move.stack.move(move.topX,move.topY); //Move the BlockStack to the correct location.
		//If the BlockStack overlaps with the BlockPalette then no slots are highlighted.
		if(BlockPalette.IsStackOverPalette()){
			Highlighter.hide(); //Hide any existing highlight.
		}
		else{
			//The slot which fits it best (if any) will be stored in CodeManager.fit.bestFit.
			CodeManager.findBestFit();
			if(CodeManager.fit.found){
				CodeManager.fit.bestFit.highlight(); //If such a slot exists, highlight it.
			}
			else{
				Highlighter.hide(); //If not, hide any existing highlight.
			}
		}
	}
}
/* Drops the BlockStack that is currently moving and connects it to the Slot/Block that fits it.
 */
CodeManager.move.end=function(){
	var move=CodeManager.move; //shorthand
	var fit=CodeManager.fit; //shorthand
	if(move.moving){ //Only run if a BlockStack is currently moving.
		move.topX=move.offsetX+move.touchX;
		move.topY=move.offsetY+move.touchY;
		//If the BlockStack overlaps with the BlockPalette, delete it.
		if(BlockPalette.IsStackOverPalette()){
			move.stack.delete();
		}
		else{
			//The Block/Slot which fits it best (if any) will be stored in CodeManager.fit.bestFit.
			CodeManager.findBestFit();
			if(fit.found){
				//Snap is onto the Block/Slot that fits it best.
				fit.bestFit.snap(move.stack.firstBlock);
			}
			else{
				//If it is not going to be snapped or deleted, simply drop it onto the current tab.
				move.stack.land();
				move.stack.updateDim(); //Fix! this line of code might not be needed.
			}
		}
		Highlighter.hide(); //Hide any existing highlight.
		move.moving=false; //There are now no moving BlockStacks.
		SaveManager.markEdited();
	}
};
/* Drops the BlockStack where it is without attaching it to anything or deleting it.
 */
CodeManager.move.interrupt=function(){
	var move=CodeManager.move; //shorthand
	if(move.moving) { //Only run if a BlockStack is currently moving.
		move.topX = move.offsetX + move.touchX;
		move.topY = move.offsetY + move.touchY;
		move.stack.land();
		move.stack.updateDim(); //Fix! this line of code might not be needed.
		Highlighter.hide(); //Hide any existing highlight.
		move.moving = false; //There are now no moving BlockStacks.
	}
}
/* Returns a boolean indicating if a point falls within a rectangular region. 
 * Useful for determining which Blocks a moving BlockStack can connect to.
 * @param {number} x1 - The x coord of the point.
 * @param {number} y1 - The y coord of the point.
 * @param {number} yR - The x coord of the top-left corner of the region.
 * @param {number} yY - The y coord of the top-left corner of the region.
 * @param {number} width - The width of the region.
 * @param {number} height - The height of the region.
 * @return {boolean} - Is the point within the region?
 */
CodeManager.move.pInRange=function(x1,y1,xR,yR,width,height){
	//Checks to see if the point is on the correct side of all four sides of the rectangular region.
	return (x1>=xR && x1<=xR+width && y1>=yR && y1<=yR+height);
}
/* Returns a boolean indicating if two rectangular regions overlap.
 * Useful for determining which Slots a moving BlockStack can connect to.
 * @param {number} x1 - The x coord of the top-left corner of the first region.
 * @param {number} y1 - The y coord of the top-left corner of the first region.
 * @param {number} width1 - The width of the first region.
 * @param {number} height1 - The height of the first region.
 * @param {number} x2 - The x coord of the top-left corner of the second region.
 * @param {number} y2 - The y coord of the top-left corner of the second region.
 * @param {number} width2 - The width of the second region.
 * @param {number} height2 - The height of the second region.
 * @return {boolean} - Do the rectangular regions overlap?
 */
CodeManager.move.rInRange=function(x1,y1,width1,height1,x2,y2,width2,height2){
	//These conditions check that there are no vertical or horizontal gaps between the regions.
	//Is the right side of region 1 to the right of the left side of region 2?
	var xBigEnough = x1+width1>=x2;
	//Is the bottom side of region 1 below the top side of region 2?
	var yBigEnough = y1+height1>=y2;
	//Is the left side of region 1 to the left of the right side of region 2?
	var xSmallEnough = x1<=x2+width2;
	//Is the top side of region 1 above the bottom side of region 2?
	var ySmallEnough = y1<=y2+height2;
	//If it passes all 4 checks, the regions overlap.
	return xBigEnough&&yBigEnough&&xSmallEnough&&ySmallEnough;
}
/* Recursively searches for the Block/Slot that best fits the moving BlockStack.
 * All results are stored in CodeManager.fit.  Nothing is returned.
 */
CodeManager.findBestFit=function(){
	var fit=CodeManager.fit; //shorthand
	fit.found=false; //Have any matching slot/block been found?
	fit.bestFit=null; //Slot/Block that is closest to the item?
	fit.dist=0; //How far is the best candidate from the ideal location?
	TabManager.activeTab.findBestFit(); //Begins the recursive calls.
}
/* Recursively updates any Blocks that are currently executing.
 * Stops the update timer if all Blocks are finished.
 */
CodeManager.updateRun=function(){
	var CM=CodeManager;
	var startingReservation=CM.reservedStackHBoutput;
	if(!TabManager.updateRun()){ //A recursive call.  Returns true if any Blocks are running.
		CM.stopUpdateTimer(); //If no Blocks are running, stop the update timer.
	}
	var now=new Date().getTime();
	var timeExpired=now-CM.repeatHBOutDelay>=CM.lastHBOutputSendTime;
	if(CM.reservedStackHBoutput!=null&&CM.reservedStackHBoutput==startingReservation&&timeExpired) {
		CM.reservedStackHBoutput = null;
	}
};
/* Recursively stops all Block execution.
 */
CodeManager.stop=function(){
	HummingbirdManager.stopHummingbirds(); //Stop any motors and LEDs on the Hummingbirds
	TabManager.stop(); //Recursive call.
	CodeManager.stopUpdateTimer(); //Stop the update timer.
	DisplayBox.hide(); //Hide any messages being displayed.
}
/* Stops the update timer.
 */
CodeManager.stopUpdateTimer=function(){
	if(CodeManager.isRunning){ //If the timer is currently running...
		//...Stop the timer.
		CodeManager.updateTimer = window.clearInterval(CodeManager.updateTimer);
		CodeManager.isRunning=false;
	}
}
/* Starts the update timer.  When it fires, the timer will call the CodeManager.updateRun function.
 */
CodeManager.startUpdateTimer=function(){
	if(!CodeManager.isRunning){ //If the timer is not running...
		//...Start the timer.
		CodeManager.updateTimer = self.setInterval(function () { CodeManager.updateRun() }, CodeManager.updateInterval);
		CodeManager.isRunning=true;
	}
}
/* Recursively passes on the message that the flag button was tapped.
 * @fix method name.
 */
CodeManager.eventFlagClicked=function(){
	TabManager.eventFlagClicked();
}
/**/
CodeManager.checkDialogDelay=function(){
	var CM=CodeManager;
	var now=new Date().getTime();
	if(CM.lastDialogDisplayTime==null||now-CM.repeatDialogDelay>=CM.lastDialogDisplayTime){
		return true;
	}
	else{
		return false;
	}
}
CodeManager.updateDialogDelay=function(){
	var CM=CodeManager;
	var now=new Date().getTime();
	CM.lastDialogDisplayTime=now;
};
CodeManager.checkHBOutputDelay=function(stack){
	var CM=CodeManager;
	var now=new Date().getTime();
	var stackReserved=CM.reservedStackHBoutput!=null&&CM.reservedStackHBoutput!=stack;
	if(CM.lastHBOutputSendTime==null||(now-CM.repeatHBOutDelay>=CM.lastHBOutputSendTime&&!stackReserved)){
		if(CM.reservedStackHBoutput==stack){
			CM.reservedStackHBoutput=null;
		}
		return true;
	}
	else{
		if(CM.reservedStackHBoutput==null){
			CM.reservedStackHBoutput=stack;
		}
		return false;
	}
};
CodeManager.updateHBOutputDelay=function(){
	CodeManager.lastHBOutputSendTime=new Date().getTime();
};
/* @fix Write documentation.
 */
CodeManager.addVariable=function(variable){
	CodeManager.variableList.push(variable);
};
/* @fix Write documentation.
 */
CodeManager.removeVariable=function(variable){
	var index=CodeManager.variableList.indexOf(variable);
	CodeManager.variableList.splice(index,1);
};
/* @fix Write documentation.
 */
CodeManager.newVariable=function(){
	var callbackFn=function(cancelled,result) {
		if(!cancelled&&CodeManager.checkVarName(result)) {
			result=result.trim();
			new Variable(result);
			SaveManager.markEdited();
			BlockPalette.getCategory("variables").refreshGroup();
		}
	};
	HtmlServer.showDialog("Create variable","Enter variable name","",callbackFn);
};
CodeManager.checkVarName=function(name){
	name=name.trim();
	if(name.length>0){
		var variables=CodeManager.variableList;
		for(var i=0;i<variables.length;i++){
			if(variables[i].getName()==name){
				return false;
			}
		}
		return true;
	}
	return false;
};
CodeManager.findVar=function(name){
	var variables=CodeManager.variableList;
	for(var i=0;i<variables.length;i++){
		if(variables[i].getName()==name){
			return variables[i];
		}
	}
	return null;
};
/* @fix Write documentation.
 */
CodeManager.addList=function(list){
	CodeManager.listList.push(list);
};
/* @fix Write documentation.
 */
CodeManager.removeList=function(list){
	var index=CodeManager.listList.indexOf(list);
	CodeManager.listList.splice(index,1);
};
/* @fix Write documentation.
 */
CodeManager.newList=function(){
	var callbackFn=function(cancelled,result) {
		if(!cancelled&&CodeManager.checkListName(result)) {
			result=result.trim();
			new List(result);
			SaveManager.markEdited();
			BlockPalette.getCategory("variables").refreshGroup();
		}
	};
	HtmlServer.showDialog("Create list","Enter list name","",callbackFn);
};
/* @fix Write documentation.
 */
CodeManager.checkListName=function(name){
	name=name.trim();
	if(name.length>0){
		var lists=CodeManager.listList;
		for(var i=0;i<lists.length;i++){
			if(lists[i].getName()==name){
				return false;
			}
		}
		return true;
	}
	return false;
};
CodeManager.findList=function(name){
	var lists=CodeManager.listList;
	for(var i=0;i<lists.length;i++){
		if(lists[i].getName()==name){
			return lists[i];
		}
	}
	return null;
};
/* @fix Write documentation.
 */
CodeManager.newBroadcastMessage=function(slot){
	slot.deselect();
	var callbackFn=function(cancelled,result) {
		if(!cancelled&&result.length>0){
			result=result.trim();
			CodeManager.addBroadcastMessage(result);
			slot.setSelectionData('"'+result+'"',new StringData(result));
		}
	};
	HtmlServer.showDialog("Create broadcast message","Enter message name","",callbackFn);
};
/* @fix Write documentation.
 */
CodeManager.checkBroadcastMessage=function(message){
	var messages=CodeManager.broadcastList;
	for(var i=0;i<messages.length;i++){
		if(messages[i]==message){
			return false;
		}
	}
	return true;
};
/* @fix Write documentation.
 */
CodeManager.addBroadcastMessage=function(message){
	if(CodeManager.checkBroadcastMessage(message)){
		CodeManager.broadcastList.push(message);
	}
};
/* @fix Write documentation.
 */
CodeManager.removeUnusedMessages=function(){
	var messages=CodeManager.broadcastList;
	for(var i=0;i<messages.length;i++){
		if(!TabManager.checkBroadcastMessageAvailable(messages[i])){
			messages.splice(i,1);
		}
	}
};
/* @fix Write documentation.
 */
CodeManager.updateAvailableMessages=function(){
	CodeManager.broadcastList=new Array();
	TabManager.updateAvailableMessages();
};
/* @fix Write documentation.
 */
CodeManager.eventBroadcast=function(message){
	TabManager.eventBroadcast(message);
};
CodeManager.hideHBDropDowns=function(){
	TabManager.hideHBDropDowns();
	BlockPalette.hideHBDropDowns();
};
CodeManager.showHBDropDowns=function(){
	TabManager.showHBDropDowns();
	BlockPalette.showHBDropDowns();
};
CodeManager.countHBsInUse=function(){
	return TabManager.countHBsInUse();
};
/* @fix Write documentation.
 */
CodeManager.checkBroadcastRunning=function(message){
	return TabManager.checkBroadcastRunning(message);
};

CodeManager.createXml=function(){
	var CM=CodeManager;
	var xmlDoc = XmlWriter.newDoc("project");
	var project=xmlDoc.getElementsByTagName("project")[0];
	var fileName="project";
	if(SaveManager.named){
		fileName=SaveManager.fileName;
	}
	XmlWriter.setAttribute(project,"name",fileName);
	XmlWriter.setAttribute(project,"appVersion",GuiElements.appVersion);
	XmlWriter.setAttribute(project,"created",new Date().getTime());
	XmlWriter.setAttribute(project,"modified",new Date().getTime());
	var variables=XmlWriter.createElement(xmlDoc,"variables");
	for(var i=0;i<CM.variableList.length;i++){
		variables.appendChild(CM.variableList[i].createXml(xmlDoc));
	}
	project.appendChild(variables);
	var lists=XmlWriter.createElement(xmlDoc,"lists");
	for(i=0;i<CM.listList.length;i++){
		lists.appendChild(CM.listList[i].createXml(xmlDoc));
	}
	project.appendChild(lists);
	project.appendChild(TabManager.createXml(xmlDoc));
	return xmlDoc;
};
CodeManager.importXml=function(projectNode){
	CodeManager.deleteAll();
	var variablesNode=XmlWriter.findSubElement(projectNode,"variables");
	if(variablesNode!=null) {
		var variableNodes=XmlWriter.findSubElements(variablesNode,"variable");
		for (var i = 0; i < variableNodes.length; i++) {
			Variable.importXml(variableNodes[i]);
		}
	}
	var listsNode=XmlWriter.findSubElement(projectNode,"lists");
	if(listsNode!=null) {
		var listNodes = XmlWriter.findSubElements(listsNode, "list");
		for (i = 0; i < listNodes.length; i++) {
			List.importXml(listNodes[i]);
		}
	}
	BlockPalette.getCategory("variables").refreshGroup();
	var tabsNode=XmlWriter.findSubElement(projectNode,"tabs");
	TabManager.importXml(tabsNode);
	HummingbirdManager.updateSelectableHBs();
};
CodeManager.deleteAll=function(){
	var CM=CodeManager;
	CM.stop();
	TabManager.deleteAll();
	CodeManager();
};
CodeManager.renameVariable=function(variable){
	TabManager.renameVariable(variable);
	BlockPalette.getCategory("variables").refreshGroup();
};
CodeManager.deleteVariable=function(variable){
	TabManager.deleteVariable(variable);
	BlockPalette.getCategory("variables").refreshGroup();
};
CodeManager.renameList=function(list){
	TabManager.renameList(list);
	BlockPalette.getCategory("variables").refreshGroup();
};
CodeManager.deleteList=function(list){
	TabManager.deleteList(list);
	BlockPalette.getCategory("variables").refreshGroup();
};
CodeManager.checkVariableUsed=function(variable){
	return TabManager.checkVariableUsed(variable);
};
CodeManager.checkListUsed=function(list){
	return TabManager.checkListUsed(list);
};
CodeManager.beatsToMs=function(beats){
	var tempo=CodeManager.sound.tempo;
	var res=beats/tempo*60*1000;
	if(isNaN(res)||!isFinite(res)){
		return 0;
	}
	return res;
};
CodeManager.setSoundTempo=function(newTempo){
	if(isFinite(newTempo)&&!isNaN(newTempo)){
		if(newTempo>=500){
			CodeManager.sound.tempo=500;
		}
		else if(newTempo<=20){
			CodeManager.sound.tempo=20;
		}
		else{
			CodeManager.sound.tempo=newTempo;
		}
	}
};