function Category(x,y,index){
	this.index=index;
	this.x=x;
	this.y=y;
	this.group=this.createGroup();
	this.id=BlockList.getCatId(index);
	this.name=BlockList.getCatName(index);
	this.currentBlockX=BlockPalette.mainHMargin;
	this.currentBlockY=BlockPalette.mainVMargin
	this.lastHadStud=false;
	this.button=this.createButton();
	this.fillGroup();
}
Category.prototype.createButton=function(){
	return new CategoryBN(this.x,this.y,this);
}
Category.prototype.createGroup=function(){
	return GuiElements.create.group(0,TitleBar.height+BlockPalette.catH);
}
Category.prototype.fillGroup=function(){
	BlockList["populateCat_"+this.id](this);
}
Category.prototype.addBlock=function(blockName){
	var block=new window[blockName](this.currentBlockX,this.currentBlockY);
	if(this.lastHadStud&&!block.topOpen){
		this.currentBlockY+=BlockGraphics.command.bumpDepth;
		block.move(this.currentBlockX,this.currentBlockY);
	}
	if(block.hasHat){
		this.currentBlockY+=BlockGraphics.hat.hatHEstimate;
		block.move(this.currentBlockX,this.currentBlockY);
	}
	this.displayStack=new DisplayStack(block,this.group);
	height=this.displayStack.firstBlock.height;
	this.currentBlockY+=height;
	this.currentBlockY+=BlockPalette.blockMargin;
	this.lastHadStud=false;
	if(block.bottomOpen){
		this.lastHadStud=true;
	}
}
Category.prototype.addSpace=function(){
	this.currentBlockY+=BlockPalette.sectionMargin;
}
Category.prototype.trimBottom=function(){
	this.currentBlockY-=BlockPalette.blockMargin;
	this.height=this.currentBlockY-this.y;
}
Category.prototype.select=function(){
	if(BlockPalette.selectedCat==this){
		return;
	}
	if(BlockPalette.selectedCat!=null){
		BlockPalette.selectedCat.deselect();
	}
	GuiElements.layers.palette.appendChild(this.group);
	BlockPalette.selectedCat=this;
	this.button.select();
}
Category.prototype.deselect=function(){
	BlockPalette.selectedCat=null;
	this.group.remove();
	this.button.deselect();
}