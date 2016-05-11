var fs = require('fs')
var analyse = require('./lib/analyzer')
var CPU = require('./lib/c6502')
var cpu = new CPU()
var Cartridge = require('./lib/cartridge')
var Directives = require('./lib/directives')
var directives = new Directives()
var asm65_tokens = require('./lib/tokens')

function Compiler () {}

Compiler.prototype.open_file = function (file) {
  return fs.readFileSync(file, 'binary')
}

Compiler.prototype.write_file = function (filename, data) {
  fs.writeFileSync(filename, data, 'binary')
}

Compiler.prototype.lexical = function (code) {
  return analyse(code)
}

function look_ahead (tokens, index, type, value) {
  if (index > tokens.length - 1) {
    return 0
  }
  var token = tokens[index]
  if (token.type === type) {
    if (value === undefined || token.value.toUpperCase() === value.toUpperCase()) {
      return 1
    }
  }
  return 0
}

function t_instruction (tokens, index) {
  return look_ahead(tokens, index, 'T_INSTRUCTION')
}

function t_hex_number (tokens, index) {
  return look_ahead(tokens, index, 'T_HEX_NUMBER')
}

function t_binary_number (tokens, index) {
  return look_ahead(tokens, index, 'T_BINARY_NUMBER')
}

function t_number (tokens, index) {
  return OR([t_hex_number, t_binary_number, t_decimal_argument], tokens, index)
}

function t_relative (tokens, index) {
  if (t_instruction(tokens, index)) {
    var valid = ['BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS']
    for (var v in valid) {
      if (tokens[index].value.toUpperCase() === valid[v]) {
        return 1
      }
    }
  }
  return 0
}

function t_label (tokens, index) {
  return look_ahead(tokens, index, 'T_LABEL')
}

function t_marker (tokens, index) {
  return look_ahead(tokens, index, 'T_MARKER')
}

function t_address_or_t_binary_number_or_t_decimal_argument (tokens, index) {
  return OR([t_address, t_binary_number, t_decimal_argument], tokens, index)
}

function t_address_or_t_marker (tokens, index) {
  return OR([t_address, t_marker], tokens, index)
}

function t_address (tokens, index) {
  return look_ahead(tokens, index, 'T_ADDRESS')
}

function t_zeropage (tokens, index) {
  if (t_address(tokens, index) && tokens[index].value.length === 3) {
    return 1
  }
  return 0
}

function t_separator (tokens, index) {
  return look_ahead(tokens, index, 'T_SEPARATOR', ',')
}

function t_accumulator (tokens, index) {
  return look_ahead(tokens, index, 'T_ACCUMULATOR', 'A')
}

function t_register_x (tokens, index) {
  return look_ahead(tokens, index, 'T_REGISTER', 'X')
}

function t_register_y (tokens, index) {
  return look_ahead(tokens, index, 'T_REGISTER', 'Y')
}

function t_open (tokens, index) {
  return look_ahead(tokens, index, 'T_OPEN', '(')
}

function t_close (tokens, index) {
  return look_ahead(tokens, index, 'T_CLOSE', ')')
}

function t_open_square_brackets (tokens, index) {
  return look_ahead(tokens, index, 'T_OPEN_SQUARE_BRACKETS', '[')
}

function t_close_square_brackets (tokens, index) {
  return look_ahead(tokens, index, 'T_CLOSE_SQUARE_BRACKETS', ']')
}

function t_nesasm_compatible_open (tokens, index) {
  return OR([t_open, t_open_square_brackets], tokens, index)
}

function t_nesasm_compatible_close (tokens, index) {
  return OR([t_close, t_close_square_brackets], tokens, index)
}

function t_endline (tokens, index) {
  return look_ahead(tokens, index, 'T_ENDLINE', '\n')
}

function OR (args, tokens, index) {
  for (var t in args) {
    if (args[t](tokens, index)) {
      return args[t](tokens, index)
    }
  }
  return 0
}

function t_modifier (tokens, index) {
  return look_ahead(tokens, index, 'T_MODIFIER')
}

function t_directive (tokens, index) {
  return look_ahead(tokens, index, 'T_DIRECTIVE')
}

function t_directive_argument (tokens, index) {
  return OR([t_list, t_address, t_binary_number, t_marker, t_decimal_argument, t_string], tokens, index)
}

function t_decimal_argument (tokens, index) {
  return look_ahead(tokens, index, 'T_DECIMAL_ARGUMENT')
}

function t_string (tokens, index) {
  return look_ahead(tokens, index, 'T_STRING')
}

function t_list (tokens, index) {
  if (t_address_or_t_binary_number_or_t_decimal_argument(tokens, index) && t_separator(tokens, index + 1)) {
    var islist = 1
    var arg = 0
    while (islist) {
      islist = islist & t_separator(tokens, index + (arg * 2) + 1)
      islist = islist & t_address_or_t_binary_number_or_t_decimal_argument(tokens, index + (arg * 2) + 2)
      if (t_endline(tokens, index + (arg * 2) + 3) || index + (arg * 2) + 3 === tokens.length) {
        break
      }
      arg++
    }
    if (islist) {
      return ((arg + 1) * 2) + 1
    }
  }
  return 0
}

var asm65_bnf = [
  {type: 'S_RS', bnf: [t_marker, t_directive, t_directive_argument]},
  {type: 'S_DIRECTIVE', bnf: [t_directive, t_directive_argument]},
  {type: 'S_RELATIVE', bnf: [t_relative, t_address_or_t_marker]},
  {type: 'S_IMMEDIATE', bnf: [t_instruction, t_number]},
  {type: 'S_IMMEDIATE_WITH_MODIFIER', bnf: [t_instruction, t_modifier, t_open, t_address_or_t_marker, t_close]}, // nesasm hack
  {type: 'S_ACCUMULATOR', bnf: [t_instruction, t_accumulator]},
  {type: 'S_ZEROPAGE_X', bnf: [t_instruction, t_zeropage, t_separator, t_register_x]},
  {type: 'S_ZEROPAGE_Y', bnf: [t_instruction, t_zeropage, t_separator, t_register_y]},
  {type: 'S_ZEROPAGE', bnf: [t_instruction, t_zeropage]},
  {type: 'S_ABSOLUTE_X', bnf: [t_instruction, t_address_or_t_marker, t_separator, t_register_x]},
  {type: 'S_ABSOLUTE_Y', bnf: [t_instruction, t_address_or_t_marker, t_separator, t_register_y]},
  {type: 'S_ABSOLUTE', bnf: [t_instruction, t_address_or_t_marker]},
  {type: 'S_INDIRECT_X', bnf: [t_instruction, t_nesasm_compatible_open, t_address_or_t_marker, t_separator, t_register_x, t_nesasm_compatible_close]},
  {type: 'S_INDIRECT_Y', bnf: [t_instruction, t_nesasm_compatible_open, t_address_or_t_marker, t_nesasm_compatible_close, t_separator, t_register_y]},
  {type: 'S_IMPLIED', bnf: [t_instruction]}
]

Compiler.prototype.syntax = function (tokens) {
  var ast = []
  var x = 0
  var labels = []
  var erros = []
  var move = false
  while (x < tokens.length) {
    if (t_label(tokens, x)) {
      labels.push(get_value(tokens[x]))
      x++
    } else if (t_endline(tokens, x)) {
      x++
    } else {
      for (var bnf in asm65_bnf) {
        var leaf = {}
        var look_ahead = 0
        move = false
        for (var i in asm65_bnf[bnf].bnf) {
          move = asm65_bnf[bnf].bnf[i](tokens, x + look_ahead)
          if (!move) {
            break
          }
          look_ahead++
        }
        if (move) {
          if (labels.length > 0) {
            leaf.labels = labels
            labels = []
          }
          var size = 0
          look_ahead = 0
          for (var b in asm65_bnf[bnf].bnf) {
            size += asm65_bnf[bnf].bnf[b](tokens, x + look_ahead)
            look_ahead++
          }
          leaf.children = tokens.slice(x, x + size)
          leaf.type = asm65_bnf[bnf].type
          ast.push(leaf)
          x += size
          break
        }
      }
      if (!move) {
        var walk = 0
        while (!t_endline(tokens, x + walk) && x + walk < tokens.length) {
          walk++
        }
        var erro = {}
        erro.type = 'Syntax Error'
        erro.children = tokens.slice(x, x + walk)
        erro.message = 'Invalid syntax'
        erros.push(erro)
        x += walk
      }
    }
  }
  if (erros.length > 0) {
    var e = new Error()
    e.name = 'Syntax Error'
    e.message = 'There were found ' + erros.length + ' erros:\n'
    e.ast = ast
    e.erros = erros
    throw e
  }
  return ast
}

function get_value (token, labels) {
  var m
  if (token.type === 'T_ADDRESS') {
    m = asm65_tokens[1].regex.exec(token.value)
    return parseInt(m[2], 16)
  } else if (token.type === 'T_HEX_NUMBER') {
    m = asm65_tokens[2].regex.exec(token.value)
    return parseInt(m[2], 16)
  } else if (token.type === 'T_BINARY_NUMBER') {
    m = asm65_tokens[3].regex.exec(token.value)
    return parseInt(m[2], 2)
  } else if (token.type === 'T_DECIMAL_ARGUMENT') {
    return parseInt(token.value, 10)
  } else if (token.type === 'T_LABEL') {
    m = asm65_tokens[4].regex.exec(token.value)
    return m[2]
  } else if (token.type === 'T_MARKER') {
    return labels[token.value]
  } else if (token.type === 'T_STRING') {
    return token.value.substr(1, token.value.length - 2)
  }
  throw new Error('Could not get that value')
}

Compiler.prototype.get_labels = function (ast) {
  var labels = {}
  var address = 0
  ast.forEach(function (leaf) {
    if (leaf.type === 'S_DIRECTIVE' && leaf.children[0].value === '.org') {
      address = parseInt(leaf.children[1].value.substr(1), 16)
    }
    if (leaf.labels !== undefined) {
      labels[leaf.labels[0]] = address
    }
    if (leaf.type !== 'S_DIRECTIVE' && leaf.type !== 'S_RS') {
      var size = cpu.address_mode_def[leaf.type].size
      address += size
    } else if (leaf.type === 'S_DIRECTIVE' && leaf.children[0].value === '.db') {
      for (var i in leaf.children) {
        if (leaf.children[i].type === 'T_ADDRESS') {
          address++
        }
      }
    } else if (leaf.type === 'S_DIRECTIVE' && leaf.children[0].value === '.incbin') {
      address += 4 * 1024 // TODO check file size
    }
  })
  return labels
}

Compiler.prototype.semantic = function (ast, iNES) {
  var cart = new Cartridge()
  var labels = this.get_labels(ast)
  // find all labels o the symbol table
  var erros = []
  var erro
  // Translate opcodes
  var address = 0
  ast.forEach(function (leaf) {
    if (leaf.type === 'S_RS') {
      // marker
      labels[leaf.children[0].value] = cart.rs
      cart.rs += get_value(leaf.children[2])
    } else if (leaf.type === 'S_DIRECTIVE') {
      var directive = leaf.children[0].value
      var argument
      if (leaf.children.length === 2) {
        argument = get_value(leaf.children[1], labels)
      } else {
        argument = leaf.children.slice(1, leaf.children.length)
      }
      if (directives.directive_list[directive] !== undefined) {
        directives.directive_list[directive](argument, cart)
      } else {
        erro = {}
        erro.type = 'Unknown Directive'
        erro.leafChildren = leaf.children
        erros.push(erro)
      }
    } else {
      var instruction
      switch (leaf.type) {
        case 'S_IMPLIED':
        case 'S_ACCUMULATOR':
          instruction = leaf.children[0].value
          address = false
          break
        case 'S_RELATIVE':
          instruction = leaf.children[0].value
          address = get_value(leaf.children[1], labels)
          address = 126 + (address - cart.pc)
          if (address === 128) {
            address = 0
          } else if (address < 128) {
            address = address | 128
          } else if (address > 128) {
            address = address & 127
          }
          break
        case 'S_IMMEDIATE_WITH_MODIFIER':
          instruction = leaf.children[0].value
          var modifier = leaf.children[1].value
          address = get_value(leaf.children[3], labels)
          if (modifier === '#LOW') {
            address = (address & 0x00ff)
          } else if (modifier === '#HIGH') {
            address = (address & 0xff00) >> 8
          }
          break
        case 'S_IMMEDIATE':
        case 'S_ZEROPAGE':
        case 'S_ABSOLUTE':
        case 'S_ZEROPAGE_X':
        case 'S_ZEROPAGE_Y':
        case 'S_ABSOLUTE_X':
        case 'S_ABSOLUTE_Y':
          instruction = leaf.children[0].value
          address = get_value(leaf.children[1], labels)
          break
        case 'S_INDIRECT_X':
        case 'S_INDIRECT_Y':
          instruction = leaf.children[0].value
          address = get_value(leaf.children[2], labels)
          break
      }
      var address_mode = cpu.address_mode_def[leaf.type].short
      var opcode = cpu.opcodes[instruction.toUpperCase()][address_mode]
      if (opcode === undefined) {
        erro = {}
        erro.type = 'SEMANTIC ERROR'
        erro.msg = 'invalid opcode'
        erro.sentence = leaf
        erros.push(erro)
      } else if (address_mode === 'sngl' || address_mode === 'acc') {
        cart.append_code([opcode])
      } else if (cpu.address_mode_def[leaf.type].size === 2) {
        cart.append_code([opcode, address])
      } else {
        var arg1 = (address & 0x00ff)
        var arg2 = (address & 0xff00) >> 8
        cart.append_code([opcode, arg1, arg2])
      }
    }
  })
  if (erros.length > 0) {
    var e = new Error()
    e.name = 'Semantic Error'
    e.message = 'Semantic Error Message'
    e.erros = erros
    throw e
  }
  if (iNES) {
    return cart.get_ines_code()
  } else {
    return cart.get_code()
  }
}

Compiler.prototype.nes_compiler = function (code) {
  var tokens
  var erros = []
  try {
    tokens = this.lexical(code)
  } catch (e) {
    tokens = e.tokens
    erros = erros.concat(e.message)
  }
  var ast
  try {
    ast = this.syntax(tokens)
  } catch (e) {
    ast = e.ast
    erros = erros.concat(e.message)
  }
  var opcodes
  try {
    opcodes = this.semantic(ast, true)
  } catch (e) {
    erros = erros.concat(e.message)
  }
  if (erros.length > 0) {
    throw erros
  } else {
    return String.fromCharCode.apply(undefined, opcodes)
  }
}

module.exports = Compiler
