import Cocoa
let size = 1024
let bitmap = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep:bitmap)
NSColor.clear.setFill()
NSRect(x:0,y:0,width:size,height:size).fill()
let rect=NSRect(x:80,y:80,width:864,height:864)
let path=NSBezierPath(roundedRect:rect,xRadius:194,yRadius:194)
NSGradient(starting:NSColor(red:0.25,green:0.23,blue:0.33,alpha:1),ending:NSColor(red:0.09,green:0.10,blue:0.13,alpha:1))!.draw(in:path,angle:-70)
NSColor(white:1,alpha:0.12).setStroke()
let rim=NSBezierPath(roundedRect:rect.insetBy(dx:2,dy:2),xRadius:192,yRadius:192)
rim.lineWidth=4;rim.stroke()
NSColor(red:0.74,green:0.68,blue:0.89,alpha:1).setStroke()
let arrow=NSBezierPath();arrow.lineWidth=44;arrow.lineCapStyle = .round;arrow.lineJoinStyle = .round
arrow.move(to:NSPoint(x:285,y:640));arrow.line(to:NSPoint(x:430,y:512));arrow.line(to:NSPoint(x:285,y:384));arrow.stroke()
let line=NSBezierPath();line.lineWidth=44;line.lineCapStyle = .round;line.move(to:NSPoint(x:520,y:384));line.line(to:NSPoint(x:730,y:384));line.stroke()
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[1]))
