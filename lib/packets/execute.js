var CursorType   = require('../constants/cursor');
var CommandCodes = require('../constants/commands');
var Types        = require('../constants/types');
var Packet       = require('../packets/packet');

function Execute(id, parameters)
{
  this.id = id;
  this.parameters = parameters;
}

Execute.prototype.toPacket = function()
{

  // TODO: don't try to calculate packet length in advance, allocate some big buffer in advance (header + 256 bytes?)
  // and copy + reallocate if not enough

  var i;
  // 0 + 4 - length, seqId
  // 4 + 1 - COM_EXECUTE
  // 5 + 4 - stmtId
  // 9 + 1 - flags
  // 10 + 4 - iteration-count (always 1)
  var length = 14;
  if (this.parameters && this.parameters.length > 0)
  {
    length += Math.floor((this.parameters.length + 7) / 8);
    length += 1; // new-params-bound-flag
    length += 2*this.parameters.length;  // type byte for each parameter if new-params-bound-flag is set
    for (i=0; i < this.parameters.length; i++)
    {
      if (this.parameters[i] !== null) {
        var str = this.parameters[i].toString();
        // TODO: utf-encode only string parameters. Don't send buffers as string
        var byteLen = Buffer.byteLength(str, 'utf8');
        length += Packet.lengthCodedNumberLength(byteLen);
        length += byteLen;
      }
    }
  }

  var buffer = new Buffer(length);
  var packet = new Packet(0, buffer);
  packet.offset = 4;
  packet.writeInt8(CommandCodes.EXECUTE);
  packet.writeInt32(this.id);
  packet.writeInt8(CursorType.NO_CURSOR);  // flags
  packet.writeInt32(1); // iteration-count, always 1
  if (this.parameters.length > 0) {

    var bitmap = 0;
    var bitValue = 1;
    for (i=0; i < this.parameters.length; i++)
    {
      if (this.parameters[i] === null)
        bitmap += bitValue;
      bitValue *= 2;
      if (bitValue == 256) {
        packet.writeInt8(bitmap);
        bitmap = 0;
        bitValue = 1;
      }
    }
    if (bitValue != 256)
      packet.writeInt8(bitmap);

    // TODO: explain meaning of the flag
    // afaik, if set n*2 bytes with type of parameter are sent before parameters
    // if not, previous execution types are used (TODO prooflink)
    packet.writeInt8(1); // new-params-bound-flag

    // TODO: don't typecast always to sting, use parameters type
    for (i=0; i < this.parameters.length; i++)
    {
      if (this.parameters[i] !== null)
        packet.writeInt16(Types.VAR_STRING);
      else
        packet.writeInt16(Types.NULL);
    }
    for (i=0; i < this.parameters.length; i++)
    {
      if (this.parameters[i] !== null)
        packet.writeLengthCodedString(this.parameters[i].toString());
    }
  }
  return packet;
};

module.exports = Execute;
