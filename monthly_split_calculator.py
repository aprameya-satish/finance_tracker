import numpy as np
import pandas as pd
from os.path import join
from os import listdir
import argparse
import matplotlib.pyplot as plt

def csv_subtotals(data: pd.DataFrame):
    
    st = {}
    st['A_subtotal']    = np.abs(data[data['Who'] == 'A']['Amount'].sum(axis='index'))
    st['S_subtotal']    = np.abs(data[data['Who'] == 'S']['Amount'].sum(axis='index'))
    st['both_subtotal'] = np.abs(data.loc[(data['Who'] != 'A') & (data['Who'] != 'S')]['Amount'].sum(axis='index'))

    return st

def get_credit_card_csv(csv_filepath):
    data = pd.read_csv(csv_filepath)
    return data

def get_parsed_args():
    parser = argparse.ArgumentParser(description='Compute monthly expenses split')
    parser.add_argument('--csv_directory', metavar='fpath', type=str, nargs=1,
                        help='Filepath containing monthly financial information.')
    parser.add_argument('-d', '--debug_mode', action='store_true')

    args = parser.parse_args()
    return args

def get_csv_files(csv_dir, filter='.csv'):
    '''
    Gets all CSV files present in the specified directory.

    Attributes:
    csv_dir : directory containing csv of monthly expenses
    filter  : string (typically file extension) to query within files

    Returns:
    csv_files : list of absolute filepaths for each file found in csv_dir
    '''
    csv_files = [join(csv_dir, xx) for xx in listdir(csv_dir) if (filter in xx) or (filter.upper() in xx)] 
    return csv_files

def category_totals(data):
    cat_totals = {}

    try:
        category_series = data['Category']
    except:
        print('No column named Category. Skipping CSV')
        return cat_totals

    categories = category_series.unique()

    for category in categories:
        # Using abs is risky if returns are present. Will need to place a check on this.
        cat_totals[category] = np.abs(data[data['Category'] == category]['Amount'].sum(axis='index'))

    return cat_totals


def plot_pie_chart(cat_totals):

    '''
    Example code taken from : https://stackoverflow.com/questions/70200626/preventing-overlapping-labels-in-a-pie-chart-python-matplotlib    
    '''

    bbox_props=dict(boxstyle='square,pad=0.3',fc ='w',ec='k',lw=0.72)
    kw=dict(xycoords='data',textcoords='data',arrowprops=dict(arrowstyle='-'),zorder=0,va='center')

    _, ax1=plt.subplots()

    nl         = '\n'
    cat_labels = list(cat_totals.keys())
    values     = np.array(list(cat_totals.values()))  
    labels     = [f"{xx[0]}:({xx[1]:.2f} USD)" for xx in zip(cat_labels, values)]
    
    # Add code
    annotate_dict = {k:v for k,v in zip(labels, values)}
    val           = [[x,y] for x,y in zip(sorted(values, reverse=True),sorted(values))]
    values1       = sum(val, [])

    new_labels = []
    for v in values1[:len(values)]:
        for key, value in annotate_dict.items():
            if v == value:
                new_labels.append(key)
                
    wedges,texts=ax1.pie(values1[:len(values)],labeldistance=1.2,startangle=90)
    # explode=np.ones(len(values))*0.01
    for i,p in enumerate(wedges):
        ang=(p.theta2-p.theta1)/2. + p.theta1
        y=np.sin(np.deg2rad(ang))
        x=np.cos(np.deg2rad(ang))
        horizontalalignment={-1:"right",1:"left"}[int(np.sign(x))]
        connectionstyle="angle,angleA=0,angleB={}".format(ang)
        kw["arrowprops"].update({"connectionstyle":connectionstyle})
        ax1.annotate(new_labels[i],xy=(x, y),xytext=(1.35*np.sign(x),1.3*y),
                    horizontalalignment=horizontalalignment,fontsize='x-small',**kw)
                
    # Old code
    # keys         = list(cat_totals.keys())
    # values       = np.array(list(cat_totals.values()))
    # angle_values = np.array([int(value*360/np.sum(values)) for value in values])

    # legend_list  = [key + ': $'  + f'{values[ind]:.2f}' for ind, key in enumerate(keys)]

    # plt.pie(values, autopct='%1.2f%%')
    # plt.legend(legend_list, loc = 'lower right')
    # plt.show()

if __name__ == '__main__':

    args = get_parsed_args()

    if args.debug_mode == False:        
        csv_files = get_csv_files(args.csv_directory[0])
    else:
        # Test case
        print('Running Test Case:')
        # csv_directory = 'E:\\Personal\\Finance\\Credit Card Reports\\2023-05'
        csv_directory = "E:\\Finance\\Expense Tracking\\2024\\2024-03"
        csv_files = get_csv_files(csv_directory)

    cat_totals = {}
    totals     = {}

    for ind, csv_file in enumerate(csv_files):
        print('-- %s' %csv_file)
        data    = get_credit_card_csv(csv_file)
        st_tmp  = csv_subtotals(data)
        cat_tmp = category_totals(data)

        if len(cat_totals) == 0:
            cat_totals = cat_tmp
        else:
            for category in list(cat_tmp.keys()):
                if category in list(cat_totals.keys()):
                    cat_totals[category] += cat_tmp[category]
                else:
                    cat_totals[category] = cat_tmp[category]

        print('Category Totals:')
        print(cat_totals)

        if len(totals) == 0:
            totals = st_tmp
        else:
            for key in list(st_tmp.keys()):
                totals[key] += st_tmp[key]
    
    share = {'Aprameya':0, 'Savanthi':0}
    share['Aprameya'] = int(totals['A_subtotal'] + totals['both_subtotal']/2.)
    share['Savanthi'] = int(totals['S_subtotal'] + totals['both_subtotal']/2.)

    print('Split:')
    print(share)

    plot_pie_chart(cat_totals)
    plt.show()