#!/usr/bin/env python3

from pandocfilters import toJSONFilter, RawBlock, RawInline, Para, Table

def latex(s):
    return RawBlock('latex', s)

def inlatex(s):
    return RawInline('latex', s)

def tbl_caption(s):
    return Para([inlatex(r'\caption{')] + s + [inlatex('}')])

def tbl_alignment(s):
    aligns = {
        "AlignDefault": 'X',
        "AlignLeft": 'L',
        "AlignCenter": 'C',
        "AlignRight": 'R',
    }
    return ''.join([aligns[e['t']] for e in s])

def tbl_headers(s):
    result = s[0][0]['c'][:]
    # Build the columns. Note how the every column value is bold.
    # We are still missing "\textbf{" for the first column
    # and a "}" for the last column.
    for i in range(1, len(s)):
        result.append(inlatex(r'} & \textbf{'))
        result.extend(s[i][0]['c'])
    # Don't forget to close the last column's "\textbf{" before newline
    result.append(inlatex(r'} \\ \hline'))
    # Put the missing "\textbf{" in front of the list
    result.insert(0, inlatex(r'\textbf{'))
    return Para(result)

def tbl_contents(s):
    result = []
    for row in s:
        para = []
        for col in row:
            para.extend(col[0]['c'])
            para.append(inlatex(' & '))
        result.extend(para)
        result[-1] = inlatex(r' \\ \hline' '\n')
    return Para(result)

def do_filter(k, v, f, m):
    if k == "Table":
        # Ensure every alignment characters is surrounded by a pipes.
        # Get the string of the alignment characters
        # and split into an array for every characters.
        split_alignment = [c for c in tbl_alignment(v[1])]
        # Join this list into a single string with pipe symbols
        # between them, plus pipes at start and end.
        # This results in a boxed table.
        new_alignment = "|" + "|".join(split_alignment) + "|"
        return [latex(r'\begin{tabularx}{14cm}{%s} \hline' % new_alignment),
                tbl_headers(v[3]),
                tbl_contents(v[4]),
                latex(r'\end{tabularx}'),
                # Put the caption after the tabular so it appears under table.
                tbl_caption(v[0]),
                ]

if __name__ == "__main__":
    toJSONFilter(do_filter)