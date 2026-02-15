#!/bin/sh

# to_postgis_all_paved.sh
#
# Process all paved roads into PostGIS without a minimum curvature filter.
# This is a variant of to_postgis.sh that includes ALL paved road segments,
# not just those exceeding a curvature threshold.
#
# This is useful for routing and general road network analysis where we need
# complete coverage of the paved road network, not just the curviest roads.

# Set some default variables:
temp_dir="/tmp"
reuse_temp=0
output_dir="."
verbose=""
clear=""
host=""
database=""
user=""
password=""
source=""
usage="
$0 [-h] [-v] [-s] [-t temp/dir] [-C] [-H dbhost] -D database -U user -P password -S source <input-file.osm.pbf>

  -h      Show this help.
  -v      Verbose mode, print details about progress.
  -s      Include summary output implied with -v.
  -t      Use another directory for temporary files. Default: /tmp/
  -r      Keep and reuse temporary files.
  -C      Clear out previous entries from this source.
  -H      Database hostname
  -D      Database name
  -U      Database username
  -P      Database password
  -S      Source string to associate the entries with.
"
# Store our the program path.
pushd `dirname $0` > /dev/null
my_path=`pwd -P`
popd > /dev/null
script_path=`dirname $my_path`
script_path="${script_path}/bin"
##
# Allow the user to configure our variables via command-line options.
##
OPTIND=1         # Reset in case getopts has been used previously in the shell.
while getopts "h?vsrCt:H:D:U:P:S:" opt; do
  case "$opt" in
  h|\?)
    echo "$usage" >&2
    exit 1
    ;;
  v)  verbose="-v"
    ;;
  s)  summary="-s"
    ;;
  r)  reuse_temp=1
    ;;
  t)  temp_dir=$OPTARG
    ;;
  H)  host="--host $OPTARG"
    ;;
  D)  database="--database $OPTARG"
    ;;
  U)  user="--user $OPTARG"
    ;;
  P)  password="--password $OPTARG"
    ;;
  S)  source="--source $OPTARG"
    ;;
  C)  clear="--clear"
    ;;
  esac
done
shift $((OPTIND-1))
[ "$1" = "--" ] && shift
# End configuration

# Store our current working directory and the output path as variables.
cwd=`pwd`
cd $output_dir
output_dir=`pwd`
cd $cwd

##
# Process each file in the input list
##
for input_file in "$@"
do
  # Strip off the file extensions.
  filename=`basename -s .pbf $input_file`
  filename=`basename -s .osm $filename`

  if [ $reuse_temp  -eq 0 ] || [ ! -f $temp_dir/$filename.msgpack ]
  then

    # Take the following processing steps first:
    # 1. Collect the highway ways and their points into collections.
    # 2. Filter out unpaved ways and highway types we aren't interested in.
    # 3. Exclude US TIGER-imported ways that don't have names or ref tags and have not been
    #    reviewed. These are most likely driveways or forest tracks.
    # 4. Add segments and their lengths & radii.
    # 5. Calculate the curvature and filter curvature values for "deflections" (noisy data)
    # 6. Split our collections on long straight-aways (longer than 1.5 miles) to avoid
    #    highlighting long straight roads with infrequent curvy-sections.
    # 7. Sum the length and curvature of the sections in each way for reuse.
    # 8. Sort the items by their curvature value.
    # 9. Save the intermediate data.
    #
    # NOTE: Unlike to_postgis.sh, this pipeline does NOT filter by minimum curvature.
    # All paved road segments are included regardless of curvature value.
    $script_path/curvature-collect --highway_types 'motorway,trunk,primary,secondary,tertiary,unclassified,residential,service,motorway_link,trunk_link,primary_link,secondary_link,service' $verbose $input_file \
      | $script_path/curvature-pp filter_out_ways_with_tag --tag surface --values 'unpaved,dirt,gravel,fine_gravel,sand,grass,ground,pebblestone,mud,clay,dirt/sand,soil' \
      | $script_path/curvature-pp filter_out_ways_with_tag --tag service --values 'driveway,parking_aisle,drive-through,parking,bus,emergency_access' \
      | $script_path/curvature-pp filter_out_ways --match 'And(TagEmpty("name"), TagEmpty("ref"), TagEquals("highway", "residential"), TagEquals("tiger:reviewed", "no"))' \
      | $script_path/curvature-pp add_segments \
      | $script_path/curvature-pp add_segment_length_and_radius \
      | $script_path/curvature-pp add_segment_curvature \
      | $script_path/curvature-pp filter_segment_deflections \
      | $script_path/curvature-pp split_collections_on_straight_segments --length 2414 \
      | $script_path/curvature-pp roll_up_length \
      | $script_path/curvature-pp roll_up_curvature \
      | $script_path/curvature-pp sort_collections_by_sum --key curvature --direction DESC \
      > $temp_dir/$filename.msgpack
  else
    if [[ $verbose == '-v' ]]
    then
      echo "Reusing temp files.."
    fi
  fi

  # To PostGIS
  if [[ $verbose == '-v' ]]
  then
    echo "Sending to PostGIS ..."
  fi
  cat $temp_dir/$filename.msgpack \
    | $script_path/curvature-output-postgis $verbose $summary $clear $host $database $user $password $source

  if [[ ! reuse_temp ]]
  then
    rm $temp_dir/$filename.msgpack
  fi
done
